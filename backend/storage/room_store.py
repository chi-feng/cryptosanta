"""Room storage using Modal Dict with 30-day TTL and optimistic locking."""

import time
from datetime import datetime, timedelta
from typing import Optional

import modal

from backend.models.room import Room, RoomStatus

# Modal Dict for room persistence
# TTL of 30 days = 2592000 seconds
ROOM_TTL_SECONDS = 30 * 24 * 60 * 60

# Retry settings for optimistic locking
MAX_RETRIES = 5
RETRY_DELAY_MS = 50

rooms_dict = modal.Dict.from_name("cryptosanta-rooms", create_if_missing=True)


class ConcurrentModificationError(Exception):
    """Raised when optimistic locking fails after max retries."""
    pass


class RoomStore:
    """CRUD operations for rooms stored in Modal Dict with optimistic locking."""

    @staticmethod
    def create_room(room: Room) -> str:
        """Store a new room and return its ID."""
        rooms_dict[room.id] = room.model_dump_json()
        return room.id

    @staticmethod
    def get_room(room_id: str) -> Optional[Room]:
        """Retrieve a room by ID. Returns None if not found or expired."""
        data = rooms_dict.get(room_id)
        if data is None:
            return None

        room = Room.model_validate_json(data)

        # Check if room has expired (30 days)
        if datetime.utcnow() - room.created_at > timedelta(seconds=ROOM_TTL_SECONDS):
            # Clean up expired room
            try:
                rooms_dict.pop(room_id)
            except KeyError:
                pass
            return None

        return room

    @staticmethod
    def _update_room_with_version(room: Room, expected_version: int) -> bool:
        """Update room only if version matches. Returns True if successful."""
        # Re-read to verify version hasn't changed
        current = RoomStore.get_room(room.id)
        if current is None or current.version != expected_version:
            return False

        room.version = expected_version + 1
        rooms_dict[room.id] = room.model_dump_json()
        return True

    @staticmethod
    def delete_room(room_id: str) -> bool:
        """Delete a room. Returns True if deleted, False if not found."""
        try:
            rooms_dict.pop(room_id)
            return True
        except KeyError:
            return False

    @staticmethod
    def add_participant(room_id: str, encrypted_key: str) -> None:
        """Add an encrypted public key to participants with optimistic locking.

        Raises:
            ValueError: If room not found, registration closed, or duplicate key.
            ConcurrentModificationError: If concurrent modification detected after retries.
        """
        for attempt in range(MAX_RETRIES):
            room = RoomStore.get_room(room_id)
            if room is None:
                raise ValueError(f"Room {room_id} not found")
            if room.status != RoomStatus.OPEN:
                raise ValueError("Registration is closed")
            if encrypted_key in room.participants:
                raise ValueError("Duplicate registration")

            expected_version = room.version
            room.participants.append(encrypted_key)

            if RoomStore._update_room_with_version(room, expected_version):
                return

            # Retry with exponential backoff
            time.sleep(RETRY_DELAY_MS * (2 ** attempt) / 1000)

        raise ConcurrentModificationError("Failed to register after max retries, please try again")

    @staticmethod
    def set_sorted_keys(room_id: str, sorted_keys: list[str]) -> None:
        """Set sorted keys and transition to SORTED state with validation.

        Raises:
            ValueError: If room not found, wrong state, < 3 participants, or key count mismatch.
        """
        room = RoomStore.get_room(room_id)
        if room is None:
            raise ValueError(f"Room {room_id} not found")
        if room.status != RoomStatus.OPEN:
            raise ValueError("Room is not in OPEN state")
        if len(sorted_keys) < 3:
            raise ValueError("Minimum 3 participants required")

        # Validate sorted keys count matches participants
        if len(sorted_keys) != len(room.participants):
            raise ValueError(
                f"Sorted keys count ({len(sorted_keys)}) must match "
                f"participants count ({len(room.participants)})"
            )

        # Check for duplicate keys in sorted list
        if len(sorted_keys) != len(set(sorted_keys)):
            raise ValueError("Duplicate keys in sorted list")

        expected_version = room.version
        room.sorted_keys = sorted_keys
        room.status = RoomStatus.SORTED

        if not RoomStore._update_room_with_version(room, expected_version):
            raise ConcurrentModificationError("Room was modified during sorting")

    @staticmethod
    def add_message(room_id: str, message_blob: str) -> None:
        """Add an encrypted message with optimistic locking.

        Raises:
            ValueError: If room not found, wrong state, or message limit reached.
            ConcurrentModificationError: If concurrent modification detected after retries.
        """
        for attempt in range(MAX_RETRIES):
            room = RoomStore.get_room(room_id)
            if room is None:
                raise ValueError(f"Room {room_id} not found")
            if room.status == RoomStatus.OPEN:
                raise ValueError("Cannot send messages before sorting")

            # Limit messages to number of participants to prevent spam
            if len(room.messages) >= len(room.sorted_keys):
                raise ValueError("All participants have already submitted their addresses")

            expected_version = room.version

            # Transition to MESSAGING on first message
            if room.status == RoomStatus.SORTED:
                room.status = RoomStatus.MESSAGING

            room.messages.append(message_blob)

            if RoomStore._update_room_with_version(room, expected_version):
                return

            # Retry with exponential backoff
            time.sleep(RETRY_DELAY_MS * (2 ** attempt) / 1000)

        raise ConcurrentModificationError("Failed to post message after max retries, please try again")
