import { describe, it, expect } from "vitest";
import { sanitizeCommentHtml } from "./sanitize";

describe("sanitizeCommentHtml", () => {
  it("keeps allowed formatting", () => {
    const out = sanitizeCommentHtml("<b>bold</b> <i>it</i> <ul><li>x</li></ul>");
    expect(out).toContain("<b>bold</b>");
    expect(out).toContain("<li>x</li>");
  });
  it("strips scripts and event handlers", () => {
    const out = sanitizeCommentHtml('<img src=x onerror=alert(1)><script>alert(1)</script>hi');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onerror");
    expect(out).toContain("hi");
  });
  it("keeps safe links, drops javascript: urls", () => {
    expect(sanitizeCommentHtml('<a href="https://x.com">x</a>')).toContain('href="https://x.com"');
    expect(sanitizeCommentHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
  });
});
