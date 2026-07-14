import { describe, it, expect } from "vitest";
import { toNormalized, toPixels } from "./coords";

const rect = { left: 100, top: 50, width: 200, height: 400 };

describe("toNormalized", () => {
  it("maps a center click to 0.5/0.5", () => {
    expect(toNormalized(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("clamps clicks outside the image to [0,1]", () => {
    expect(toNormalized(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });
});

describe("toPixels", () => {
  it("is the inverse of toNormalized for in-bounds points", () => {
    expect(toPixels(0.5, 0.5, { width: 200, height: 400 })).toEqual({ left: 100, top: 200 });
  });
});
