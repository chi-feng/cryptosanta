/**
 * ElGamal encryption implementation over RFC 3526 Group 14.
 */

import { P, g, q } from './params';
import { modPow, modInv, randomBigIntRange } from './bigint-utils';

export interface Keypair {
  privateKey: bigint;
  publicKey: bigint;
}

export interface Ciphertext {
  c1: bigint;
  c2: bigint;
}

/**
 * Check if a value is a quadratic residue modulo P using Euler's criterion.
 * y is a QR if y^((P-1)/2) ≡ 1 (mod P)
 */
export function isQuadraticResidue(y: bigint): boolean {
  return modPow(y, (P - 1n) / 2n, P) === 1n;
}

/**
 * Generate an ElGamal keypair.
 * Ensures the public key is a quadratic residue for security.
 */
export function generateKeypair(): Keypair {
  let privateKey: bigint;
  let publicKey: bigint;

  // Generate keys until we get a QR public key
  do {
    // Private key in range [2, q-1] to stay in the subgroup
    privateKey = randomBigIntRange(2n, q - 1n);
    publicKey = modPow(g, privateKey, P);
  } while (!isQuadraticResidue(publicKey));

  return { privateKey, publicKey };
}

/**
 * Encrypt a message using ElGamal.
 *
 * @param publicKey - Recipient's public key
 * @param message - Message as BigInt (must be < P)
 * @returns Ciphertext (c1, c2)
 */
export function encrypt(publicKey: bigint, message: bigint): Ciphertext {
  if (message >= P) {
    throw new Error('Message must be less than P');
  }

  // Random ephemeral key k in [2, q-1]
  const k = randomBigIntRange(2n, q - 1n);

  const c1 = modPow(g, k, P);
  const sharedSecret = modPow(publicKey, k, P);
  const c2 = (message * sharedSecret) % P;

  return { c1, c2 };
}

/**
 * Decrypt a ciphertext using ElGamal.
 *
 * @param privateKey - Recipient's private key
 * @param ciphertext - Ciphertext (c1, c2)
 * @returns Decrypted message as BigInt
 */
export function decrypt(privateKey: bigint, ciphertext: Ciphertext): bigint {
  const { c1, c2 } = ciphertext;

  const sharedSecret = modPow(c1, privateKey, P);
  const sharedSecretInv = modInv(sharedSecret, P);

  return (c2 * sharedSecretInv) % P;
}

/**
 * Serialize a ciphertext to JSON-compatible format.
 */
export function serializeCiphertext(ct: Ciphertext): string {
  return JSON.stringify({
    c1: ct.c1.toString(),
    c2: ct.c2.toString(),
  });
}

/**
 * Deserialize a ciphertext from JSON format.
 */
export function deserializeCiphertext(json: string): Ciphertext {
  const obj = JSON.parse(json);
  return {
    c1: BigInt(obj.c1),
    c2: BigInt(obj.c2),
  };
}
