/**
 * Generates a cryptographically secure random ID (hex string)
 * Uses the Web Crypto API's getRandomValues for secure randomness
 */
export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Securely clears sensitive data from memory by overwriting with zeros.
 * Use this after cryptographic operations to minimize key exposure.
 *
 * @param data - The Uint8Array to clear. If undefined, does nothing.
 */
export function clearBuffer(data?: Uint8Array): void {
  if (typeof data !== "undefined" && data.length > 0 && typeof data.fill === "function") {
    data.fill(0);
  }
}

/**
 * Compares two byte arrays lexicographically.
 * Returns negative if a < b, positive if a > b, zero if equal.
 * Used for deterministic ordering in ECDH.
 *
 * @param a - First Uint8Array.
 * @param b - Second Uint8Array.
 * @returns A number indicating the relative order of the arrays.
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
