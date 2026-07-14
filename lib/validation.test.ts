import { describe, it, expect } from "vitest";
import { validateUpload, MAX_UPLOAD_BYTES } from "./validation";

describe("validateUpload", () => {
  it("accepts a small PNG", () => {
    expect(validateUpload({ size: 1000, type: "image/png" })).toEqual({ ok: true });
  });
  it("rejects an unsupported type", () => {
    const r = validateUpload({ size: 1000, type: "image/gif" });
    expect(r).toEqual({ ok: false, error: "Only PNG and JPG images are supported." });
  });
  it("rejects a file over the size cap", () => {
    const r = validateUpload({ size: MAX_UPLOAD_BYTES + 1, type: "image/png" });
    expect(r).toEqual({ ok: false, error: "File exceeds the 25 MB limit." });
  });
});
