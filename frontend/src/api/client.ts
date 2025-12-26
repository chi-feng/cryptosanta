/**
 * API client for CryptoSanta backend.
 */

// TODO: Update this to the Modal deployment URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface RoomParams {
  P: string;
  g: string;
}

export interface RoomResponse {
  id: string;
  status: 'OPEN' | 'SORTED' | 'MESSAGING';
  params: RoomParams;
  sessionPublicKey: string;
  participantCount: number;
  sortedKeys: string[];
  messages: string[];
}

export interface CreateRoomRequest {
  P: string;
  g: string;
  sessionPublicKey: string;
  chairSecretHash: string;
}

export interface CreateRoomResponse {
  roomId: string;
}

export interface RegisterRequest {
  encryptedKey: string;
}

export interface SortRequest {
  sortedKeys: string[];
}

export interface MessageRequest {
  blob: string;
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new ApiError(response.status, error.detail || 'Request failed');
  }
  return response.json();
}

/**
 * Create a new Secret Santa room.
 */
export async function createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
  const response = await fetch(`${API_BASE_URL}/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse(response);
}

/**
 * Get room state.
 */
export async function getRoom(roomId: string): Promise<RoomResponse> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}`);
  return handleResponse(response);
}

/**
 * Register an encrypted public key.
 */
export async function registerKey(roomId: string, request: RegisterRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  await handleResponse(response);
}

/**
 * Get all encrypted participant keys (for Chair).
 */
export async function getParticipants(roomId: string): Promise<{ participants: string[] }> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}/participants`);
  return handleResponse(response);
}

/**
 * Upload sorted keys (Chair only).
 */
export async function sortKeys(
  roomId: string,
  request: SortRequest,
  chairSecret: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}/sort`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Chair-Secret': chairSecret,
    },
    body: JSON.stringify(request),
  });
  await handleResponse(response);
}

/**
 * Post an encrypted message.
 */
export async function postMessage(roomId: string, request: MessageRequest): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  await handleResponse(response);
}

/**
 * Get all encrypted messages.
 */
export async function getMessages(roomId: string): Promise<{ messages: string[] }> {
  const response = await fetch(`${API_BASE_URL}/room/${roomId}/messages`);
  return handleResponse(response);
}
