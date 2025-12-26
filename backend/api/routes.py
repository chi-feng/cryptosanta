"""FastAPI routes for CryptoSanta API."""

import hashlib
import uuid
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from backend.models.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    MessageRequest,
    MessagesResponse,
    ParticipantsResponse,
    RegisterRequest,
    Room,
    RoomParams,
    RoomResponse,
    RoomStatus,
    SortRequest,
)
from backend.storage.room_store import ConcurrentModificationError, RoomStore

router = APIRouter()


def verify_chair(room: Room, chair_secret: Optional[str]) -> bool:
    """Verify the chair secret matches the stored hash."""
    if not chair_secret:
        return False
    hashed = hashlib.sha256(chair_secret.encode()).hexdigest()
    return hashed == room.chair_secret_hash


@router.post("/room", response_model=CreateRoomResponse)
async def create_room(request: CreateRoomRequest) -> CreateRoomResponse:
    """Create a new Secret Santa room.

    The Chair generates cryptographic parameters and a session keypair,
    then creates a room with those parameters.
    """
    room = Room(
        id=str(uuid.uuid4()),
        status=RoomStatus.OPEN,
        params=RoomParams(P=request.P, g=request.g),
        session_public_key=request.sessionPublicKey,
        chair_secret_hash=request.chairSecretHash,
    )
    room_id = RoomStore.create_room(room)
    return CreateRoomResponse(roomId=room_id)


@router.get("/room/{room_id}", response_model=RoomResponse)
async def get_room(room_id: str) -> RoomResponse:
    """Get the current state of a room.

    Returns room status, parameters, and public data.
    Does not expose the raw encrypted participant keys (use /participants for that).
    """
    room = RoomStore.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    return RoomResponse(
        id=room.id,
        status=room.status.value,
        params={"P": room.params.P, "g": room.params.g},
        sessionPublicKey=room.session_public_key,
        participantCount=len(room.participants),
        sortedKeys=room.sorted_keys,
        messages=room.messages,
    )


@router.post("/room/{room_id}/register")
async def register(room_id: str, request: RegisterRequest) -> dict:
    """Register an encrypted public key for a participant.

    The encrypted key is the participant's public key encrypted
    with the room's session public key.
    """
    try:
        RoomStore.add_participant(room_id, request.encryptedKey)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConcurrentModificationError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/room/{room_id}/participants", response_model=ParticipantsResponse)
async def get_participants(room_id: str) -> ParticipantsResponse:
    """Get all encrypted participant keys.

    Used by the Chair to decrypt and sort the keys.
    """
    room = RoomStore.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    return ParticipantsResponse(participants=room.participants)


@router.post("/room/{room_id}/sort")
async def sort_keys(
    room_id: str,
    request: SortRequest,
    x_chair_secret: Optional[str] = Header(None, alias="X-Chair-Secret"),
) -> dict:
    """Upload sorted keys (Chair only).

    The Chair decrypts all participant keys using the session private key,
    sorts them numerically, and uploads the sorted list.

    Requires X-Chair-Secret header for authentication.
    """
    room = RoomStore.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    if not verify_chair(room, x_chair_secret):
        raise HTTPException(status_code=403, detail="Invalid chair secret")

    try:
        RoomStore.set_sorted_keys(room_id, request.sortedKeys)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConcurrentModificationError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/room/{room_id}/message")
async def post_message(room_id: str, request: MessageRequest) -> dict:
    """Post an encrypted message (address blob).

    Participants encrypt their address using their Santa's public key
    and broadcast it to the bulletin board.
    """
    try:
        RoomStore.add_message(room_id, request.blob)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConcurrentModificationError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/room/{room_id}/messages", response_model=MessagesResponse)
async def get_messages(room_id: str) -> MessagesResponse:
    """Get all encrypted messages.

    Each participant downloads all messages and attempts to decrypt
    them with their private key. Only one will succeed.
    """
    room = RoomStore.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    return MessagesResponse(messages=room.messages)
