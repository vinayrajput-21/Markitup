import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// Derive a stable 32-byte key from the app secret. Throws if unset so we never
// silently store an unencryptable / unrecoverable token.
function key(): Buffer {
  const secret = process.env.FIGMA_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("FIGMA_TOKEN_SECRET is not set (needed to encrypt Figma tokens)");
  }
  return createHash("sha256").update(secret).digest();
}

// AES-256-GCM. Returns base64 (ciphertext+authtag) and base64 iv.
export function encryptSecret(plain: string): { cipher: string; iv: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return {
    cipher: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(cipherB64: string, ivB64: string): string {
  const raw = Buffer.from(cipherB64, "base64");
  const iv = Buffer.from(ivB64, "base64");
  const tag = raw.subarray(raw.length - 16);
  const enc = raw.subarray(0, raw.length - 16);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
