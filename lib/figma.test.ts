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
  it("builds a clean fit-width embed URL from file key + node id", () => {
    const e = buildEmbedUrl("abc", "1:2");
    expect(e.startsWith("https://embed.figma.com/proto/abc/embed?")).toBe(true);
    const p = new URL(e).searchParams;
    expect(p.get("node-id")).toBe("1-2");
    expect(p.get("scaling")).toBe("scale-down-width");
    expect(p.get("hide-ui")).toBe("1");
    expect(p.get("embed-host")).toBe("markitup");
  });
});
