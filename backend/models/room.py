"""Room models for CryptoSanta."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class RoomStatus(str, Enum):
    """Room state machine states."""
    OPEN = "OPEN"          # Registration phase
    SORTED = "SORTED"      # Keys sorted, ready for messaging
    MESSAGING = "MESSAGING"  # Address exchange in progress


class RoomParams(BaseModel):
    """Cryptographic parameters for ElGamal."""
    P: str  # Prime modulus (decimal string)
    g: str  # Generator (decimal string)


class Room(BaseModel):
    """Room state stored in Modal Dict."""
    id: str
    status: RoomStatus = RoomStatus.OPEN
    params: RoomParams
    session_public_key: str  # Chair's session public key for registration encryption
    chair_secret_hash: str   # SHA-256 hash of chair secret for authentication
    participants: list[str] = Field(default_factory=list)  # Encrypted public keys
    sorted_keys: list[str] = Field(default_factory=list)   # Decrypted, sorted keys
    messages: list[str] = Field(default_factory=list)      # Encrypted message blobs
    created_at: datetime = Field(default_factory=datetime.utcnow)
    version: int = 0  # Optimistic locking version for concurrent updates


# Request/Response schemas

class CreateRoomRequest(BaseModel):
    """Request to create a new room."""
    P: str
    g: str
    sessionPublicKey: str
    chairSecretHash: str


class CreateRoomResponse(BaseModel):
    """Response after room creation."""
    roomId: str


class RegisterRequest(BaseModel):
    """Request to register an encrypted public key."""
    encryptedKey: str  # JSON string containing {c1, c2}


class SortRequest(BaseModel):
    """Request to upload sorted keys (Chair only)."""
    sortedKeys: list[str]


class MessageRequest(BaseModel):
    """Request to post an encrypted message."""
    blob: str  # JSON string containing encrypted message


class RoomResponse(BaseModel):
    """Room state response."""
    id: str
    status: str
    params: dict
    sessionPublicKey: str
    participantCount: int
    sortedKeys: list[str]
    messages: list[str]


class ParticipantsResponse(BaseModel):
    """Response with encrypted participant keys."""
    participants: list[str]


class MessagesResponse(BaseModel):
    """Response with encrypted messages."""
    messages: list[str]
