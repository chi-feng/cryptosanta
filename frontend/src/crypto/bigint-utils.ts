/**
 * BigInt utility functions for modular arithmetic.
 */

/**
 * Modular exponentiation using square-and-multiply algorithm.
 * Computes base^exp mod mod efficiently.
 */
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;

  let result = 1n;
  base = ((base % mod) + mod) % mod; // Handle negative base

  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }

  return result;
}

/**
 * Modular multiplicative inverse using Extended Euclidean Algorithm.
 * Finds x such that (a * x) mod mod = 1.
 * Throws if inverse doesn't exist (gcd(a, mod) != 1).
 */
export function modInv(a: bigint, mod: bigint): bigint {
  // Ensure a is positive
  a = ((a % mod) + mod) % mod;

  let [old_r, r] = [a, mod];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  if (old_r !== 1n) {
    throw new Error('Modular inverse does not exist');
  }

  return ((old_s % mod) + mod) % mod;
}

/**
 * Generate a cryptographically secure random BigInt with the specified number of bits.
 */
export function randomBigInt(bits: number): bigint {
  const bytes = Math.ceil(bits / 8);
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);

  let result = 0n;
  for (const byte of array) {
    result = (result << 8n) | BigInt(byte);
  }

  // Mask to exact bit length
  const mask = (1n << BigInt(bits)) - 1n;
  return result & mask;
}

/**
 * Generate a random BigInt in the range [min, max).
 */
export function randomBigIntRange(min: bigint, max: bigint): bigint {
  const range = max - min;
  const bits = range.toString(2).length;

  let result: bigint;
  do {
    result = randomBigInt(bits);
  } while (result >= range);

  return result + min;
}
