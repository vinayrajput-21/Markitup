import { describe, it, expect } from "vitest";
import { formatDateTime, emailLocalPart } from "./format";

describe("formatDateTime", () => {
  it("renders an absolute date and time", () => {
    const out = formatDateTime("2026-07-16T15:42:00.000Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/Jul|July/);
    // contains a time component
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("emailLocalPart", () => {
  it("returns the part before @", () => {
    expect(emailLocalPart("jane.doe@agency.com")).toBe("jane.doe");
  });
  it("returns empty string when there is no @", () => {
    expect(emailLocalPart("nope")).toBe("");
  });
});
