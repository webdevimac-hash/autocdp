/**
 * AES-256-GCM encryption for DMS tokens/keys stored in the database.
 * Requires ENCRYPTION_KEY env var: 64 hex chars (32 bytes).
 *
 * Format: base64(iv [12 bytes] || tag [16 bytes] || ciphertext)
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKeyMaterial(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

async function importKey(): Promise<CryptoKey> {
  const raw = getKeyMaterial();
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    encoded
  );

  // encrypted includes the 16-byte GCM tag appended to ciphertext
  const result = Buffer.concat([Buffer.from(iv), Buffer.from(encrypted)]);
  return result.toString("base64");
}

export async function decrypt(blob: string): Promise<string> {
  const key = await importKey();
  const buf = Buffer.from(blob, "base64");

  const iv = buf.subarray(0, IV_LENGTH);
  const data = buf.subarray(IV_LENGTH); // ciphertext + tag

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

export async function encryptTokens(tokens: Record<string, unknown>): Promise<string> {
  return encrypt(JSON.stringify(tokens));
}

export async function decryptTokens<T = Record<string, unknown>>(blob: string): Promise<T> {
  const json = await decrypt(blob);
  return JSON.parse(json) as T;
}
