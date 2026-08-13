export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;
export const HTML_MIME = "text/html";

// A file counts as an HTML mockup by its MIME type or, when the browser reports
// nothing (common for .html), by extension.
export function isHtmlFile(file: { name: string; type: string }): boolean {
  return file.type === HTML_MIME || /\.html?$/i.test(file.name);
}

export function validateUpload(file: { size: number; type: string; name?: string }):
  | { ok: true; kind: "image" | "html" }
  | { ok: false; error: string } {
  const html = isHtmlFile({ name: file.name ?? "", type: file.type });
  const image = ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number]);
  if (!image && !html) {
    return { ok: false, error: "Upload a PNG, JPG or HTML file." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File exceeds the 25 MB limit." };
  }
  return { ok: true, kind: html ? "html" : "image" };
}
