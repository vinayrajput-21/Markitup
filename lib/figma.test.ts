import { describe, it, expect } from "vitest";
import { parseFigmaUrl, buildEmbedUrl } from "./figma";

describe("parseFigmaUrl", () => {
  it("parses a prototype link and normalizes node-id 12-34 -> 12:34", () => {
    expect(
      parseFigmaUrl("https://www.figma.com/proto/abc123/My-Proto?node-id=12-34&scaling=scale-down"),
    ).toEqual({ fileKey: "abc123", nodeId: "12:34" });
  });

  it("parses design and file links, decoding %3A", () => {
    expect(parseFigmaUrl("https://www.figma.com/design/KEY9/Name?node-id=1-2")).toEqual({
      fileKey: "KEY9",
      nodeId: "1:2",
    });
    expect(parseFigmaUrl("https://www.figma.com/file/KEY9/Name?node-id=5%3A6")?.nodeId).toBe("5:6");
  });

  it("rejects non-Figma URLs and garbage", () => {
    expect(parseFigmaUrl("https://example.com/proto/x?node-id=1-2")).toBeNull();
    expect(parseFigmaUrl("not a url")).toBeNull();
  });

  it("rejects Figma URLs without a node id", () => {
    expect(parseFigmaUrl("https://www.figma.com/proto/abc/Name")).toBeNull();
  });
});

describe("buildEmbedUrl", () => {
  it("wraps the original prototype URL for the embed player", () => {
    const original = "https://www.figma.com/proto/abc/Name?node-id=1-2";
    const e = buildEmbedUrl(original);
    expect(e.startsWith("https://www.figma.com/embed?embed_host=markitup&url=")).toBe(true);
    expect(decodeURIComponent(e.split("url=")[1])).toBe(original);
  });
});
