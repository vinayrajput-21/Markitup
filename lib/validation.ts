export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

export function validateUpload(file: { size: number; type: string }):
  | { ok: true }
  | { ok: false; error: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Only PNG and JPG images are supported." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds the 25 MB limit." };
  }
  return { ok: true };
}
