// Hachage SHA-256 et vérification du code PIN à 4 chiffres du contrôle parental TVNest.

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}

function fallbackPinDigest(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function hashParentalPin(pin: string): Promise<string> {
  const clean = pin.trim();
  if (!isValidPinFormat(clean)) {
    throw new Error('Le code PIN doit comporter exactement 4 chiffres.');
  }
  const salted = `tvnest-parental-v1:${clean}`;
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(salted);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return fallbackPinDigest(salted);
}

export async function verifyParentalPin(
  pin: string,
  expectedHash?: string
): Promise<boolean> {
  if (!expectedHash || !isValidPinFormat(pin)) return false;
  const computed = await hashParentalPin(pin);
  return computed === expectedHash;
}
