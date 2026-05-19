import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM: 12-byte IV + 16-byte auth tag + ciphertext, base64url encoded
const IV_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(secret: string): Buffer {
  // Accept hex-encoded 32-byte key directly, otherwise SHA-256 hash the string
  const hex = Buffer.from(secret, 'hex');
  if (hex.length >= 32) return hex.subarray(0, 32);
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function decryptToken(ciphertext: string, secret: string): string {
  const key = deriveKey(secret);
  const buf = Buffer.from(ciphertext, 'base64url');
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
