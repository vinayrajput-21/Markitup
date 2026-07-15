import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MockupViewer } from "./MockupViewer";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  createPin: async () => ({ id: "pin-new", number: 1 }),
  addComment: async () => ({}),
  setPinStatus: async () => ({}),
}));

// jsdom has no layout; stub the image's bounding rect + ResizeObserver
beforeEach(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  Object.assign(global, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

describe("MockupViewer", () => {
  it("renders existing pins by number", () => {
    render(
      <MockupViewer
        mockupId="m1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[{ id: "p1", x: 0.5, y: 0.5, number: 3, status: "active", comments: [] }]}
        siblings={[{ id: "m1" }]}
      />,
    );
    expect(screen.getByLabelText("Pin 3, active")).toBeInTheDocument();
  });
});
