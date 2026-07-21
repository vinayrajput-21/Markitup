import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  process.env.FIGMA_TOKEN_SECRET = "test-secret-at-least-16-characters";
});

describe("secret encryption", () => {
  it("round-trips a token and does not store it in the clear", () => {
    const { cipher, iv } = encryptSecret("figd_super-secret-token");
    expect(cipher).not.toContain("figd_");
    expect(decryptSecret(cipher, iv)).toBe("figd_super-secret-token");
  });

  it("uses a fresh IV each time", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("fails to decrypt if the ciphertext is tampered", () => {
    const { cipher, iv } = encryptSecret("tokenX");
    const flipped = cipher.slice(0, -2) + (cipher.endsWith("A") ? "B" : "A") + cipher.slice(-1);
    expect(() => decryptSecret(flipped, iv)).toThrow();
  });
});
