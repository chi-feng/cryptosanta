/**
 * Message encoding utilities for ElGamal encryption.
 * Handles string <-> BigInt conversion and nonce padding.
 */

const NONCE_BYTES = 16; // 128-bit nonce

/**
 * Convert a string to UTF-8 bytes.
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert UTF-8 bytes to string.
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Convert bytes to BigInt (big-endian).
 */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Convert BigInt to bytes (big-endian).
 * @param n - BigInt to convert
 * @param length - Desired byte length (pads with leading zeros if needed)
 */
export function bigIntToBytes(n: bigint, length?: number): Uint8Array {
  if (n < 0n) {
    throw new Error('Cannot convert negative BigInt to bytes');
  }

  if (n === 0n) {
    return new Uint8Array(length ?? 1);
  }

  // Convert to hex and pad
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }

  const byteLength = hex.length / 2;
  const targetLength = length ?? byteLength;

  if (byteLength > targetLength) {
    throw new Error('BigInt too large for specified length');
  }

  const bytes = new Uint8Array(targetLength);
  const offset = targetLength - byteLength;

  for (let i = 0; i < byteLength; i++) {
    bytes[offset + i] = parseInt(hex.substr(i * 2, 2), 16);
  }

  return bytes;
}

/**
 * Pad a message payload with a random 128-bit nonce.
 * Format: [16 bytes nonce][payload bytes] -> BigInt
 *
 * This prevents dictionary attacks on low-entropy messages.
 */
export function padWithNonce(payload: string): { padded: bigint; totalLength: number } {
  const nonce = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(nonce);

  const payloadBytes = stringToBytes(payload);
  const combined = new Uint8Array(NONCE_BYTES + payloadBytes.length);
  combined.set(nonce, 0);
  combined.set(payloadBytes, NONCE_BYTES);

  return {
    padded: bytesToBigInt(combined),
    totalLength: combined.length,
  };
}

/**
 * Strip the nonce from a padded message and return the payload.
 *
 * @param padded - The padded BigInt
 * @param totalLength - Original total length (nonce + payload)
 * @returns The decoded payload string, or null if decoding fails
 */
export function stripNonce(padded: bigint, totalLength: number): string | null {
  try {
    const bytes = bigIntToBytes(padded, totalLength);

    // Skip the first NONCE_BYTES bytes
    const payloadBytes = bytes.slice(NONCE_BYTES);

    return bytesToString(payloadBytes);
  } catch {
    return null;
  }
}

/**
 * Encode a JSON object for encryption.
 * Adds nonce padding and converts to BigInt.
 */
export function encodeMessage(data: object): { encoded: bigint; length: number } {
  const json = JSON.stringify(data);
  const { padded, totalLength } = padWithNonce(json);
  return { encoded: padded, length: totalLength };
}

/**
 * Decode a decrypted BigInt back to a JSON object.
 * Strips nonce and parses JSON.
 *
 * @returns The parsed object, or null if decoding/parsing fails
 */
export function decodeMessage<T = unknown>(decrypted: bigint, length: number): T | null {
  try {
    const json = stripNonce(decrypted, length);
    if (!json) return null;

    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
