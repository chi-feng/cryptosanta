/**
 * Hybrid encryption: AES-GCM + ElGamal for messages larger than ~200 bytes.
 *
 * 1. Generate random AES-256 key
 * 2. Encrypt payload with AES-GCM
 * 3. Encrypt AES key with ElGamal
 */

import { encrypt as elgamalEncrypt, decrypt as elgamalDecrypt } from './elgamal';
import { bytesToBigInt, bigIntToBytes, stringToBytes, bytesToString } from './encoding';

const AES_KEY_BYTES = 32; // 256 bits

export interface HybridCiphertext {
  elgamalC1: string;  // BigInt as decimal string
  elgamalC2: string;
  iv: string;         // Base64
  ciphertext: string; // Base64
}

/**
 * Generate a random AES-256 key.
 */
async function generateAESKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message using hybrid encryption (AES-GCM + ElGamal).
 *
 * @param publicKey - Recipient's ElGamal public key
 * @param plaintext - Message to encrypt (can be any length)
 * @returns Hybrid ciphertext
 */
export async function hybridEncrypt(
  publicKey: bigint,
  plaintext: string
): Promise<HybridCiphertext> {
  // Generate AES key
  const aesKey = await generateAESKey();
  const rawKey = await crypto.subtle.exportKey('raw', aesKey);
  const keyBigInt = bytesToBigInt(new Uint8Array(rawKey));

  // ElGamal encrypt the AES key
  const { c1, c2 } = elgamalEncrypt(publicKey, keyBigInt);

  // AES-GCM encrypt the payload
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = stringToBytes(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes as BufferSource
  );

  // Encode to base64
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));

  return {
    elgamalC1: c1.toString(),
    elgamalC2: c2.toString(),
    iv: ivBase64,
    ciphertext: ciphertextBase64,
  };
}

/**
 * Decrypt a hybrid ciphertext.
 *
 * @param privateKey - Recipient's ElGamal private key
 * @param hybrid - Hybrid ciphertext
 * @returns Decrypted plaintext, or null if decryption fails
 */
export async function hybridDecrypt(
  privateKey: bigint,
  hybrid: HybridCiphertext
): Promise<string | null> {
  try {
    // Recover AES key via ElGamal
    const c1 = BigInt(hybrid.elgamalC1);
    const c2 = BigInt(hybrid.elgamalC2);
    const keyBigInt = elgamalDecrypt(privateKey, { c1, c2 });

    // Import AES key
    const keyBytes = bigIntToBytes(keyBigInt, AES_KEY_BYTES);
    const aesKey = await crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decode from base64
    const iv = Uint8Array.from(atob(hybrid.iv), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(hybrid.ciphertext), c => c.charCodeAt(0));

    // Decrypt payload
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext as BufferSource
    );

    return bytesToString(new Uint8Array(decrypted));
  } catch {
    // Decryption failed - not the intended recipient or corrupted data
    return null;
  }
}

/**
 * Serialize a hybrid ciphertext to JSON string.
 */
export function serializeHybrid(ct: HybridCiphertext): string {
  return JSON.stringify(ct);
}

/**
 * Deserialize a hybrid ciphertext from JSON string.
 */
export function deserializeHybrid(json: string): HybridCiphertext {
  return JSON.parse(json);
}
