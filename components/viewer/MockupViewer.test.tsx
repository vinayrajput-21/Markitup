import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MockupViewer } from "./MockupViewer";
import { createPin, addComment } from "@/app/app/mockups/[mockupId]/actions";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  createPin: vi.fn(async () => ({ id: "p1", number: 1 })),
  addComment: vi.fn(async () => ({})),
  setPinStatus: vi.fn(async () => ({})),
}));

const mockCreatePin = vi.mocked(createPin);
const mockAddComment = vi.mocked(addComment);

// jsdom has no layout; stub the image's bounding rect + ResizeObserver
beforeEach(() => {
  mockCreatePin.mockReset();
  mockCreatePin.mockResolvedValue({ id: "p1", number: 1 });
  mockAddComment.mockReset();
  mockAddComment.mockResolvedValue({});
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

function renderViewer() {
  return render(
    <MockupViewer
      mockupId="m1"
      imageUrl="http://x/y.png"
      imageName="y.png"
      initialPins={[]}
      siblings={[{ id: "m1" }]}
      members={[]}
    />,
  );
}

describe("MockupViewer", () => {
  it("renders existing pins by number", () => {
    render(
      <MockupViewer
        mockupId="m1"
        imageUrl="http://example.com/a.png"
        imageName="a.png"
        initialPins={[{ id: "p1", x: 0.5, y: 0.5, number: 3, status: "active", comments: [] }]}
        siblings={[{ id: "m1" }]}
        members={[]}
      />,
    );
    expect(screen.getByLabelText("Pin 3, active")).toBeInTheDocument();
  });

  it("opens a comment popup when the image is clicked without creating a pin", () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    fireEvent.click(img);
    expect(screen.getByPlaceholderText(/add comment here/i)).toBeTruthy();
    expect(mockCreatePin).not.toHaveBeenCalled();
  });

  it("creates the pin and its first comment on submit", async () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    fireEvent.click(img);
    const textarea = screen.getByPlaceholderText(/add comment here/i);
    fireEvent.change(textarea, { target: { value: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    await screen.findByLabelText("Pin 1, active");
    expect(mockCreatePin).toHaveBeenCalledTimes(1);
    expect(mockCreatePin).toHaveBeenCalledWith("m1", 0, 0);
    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith("m1", "p1", "Hello there");
    // popup closes after success
    expect(screen.queryByPlaceholderText(/add comment here/i)).toBeNull();
  });

  it("does not call any action when Cancel is clicked", () => {
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    fireEvent.click(img);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockCreatePin).not.toHaveBeenCalled();
    expect(mockAddComment).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/add comment here/i)).toBeNull();
  });

  it("shows an error and appends no pin when addComment fails", async () => {
    mockAddComment.mockResolvedValue({ error: "nope" });
    renderViewer();
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    fireEvent.click(img);
    const textarea = screen.getByPlaceholderText(/add comment here/i);
    fireEvent.change(textarea, { target: { value: "Will fail" } });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("nope");
    expect(screen.queryByLabelText(/Pin 1/)).toBeNull();
    // popup stays open so the user can retry
    expect(screen.getByPlaceholderText(/add comment here/i)).toBeTruthy();
  });

  it("labels a newly created pin comment with the current user's name", async () => {
    render(
      <MockupViewer
        mockupId="m1"
        imageUrl="http://x/y.png"
        imageName="y.png"
        initialPins={[]}
        siblings={[{ id: "m1" }]}
        members={[]}
        currentUserName="Ravi Rajput"
      />,
    );
    const img = screen.getByAltText("mockup");
    fireEvent.load(img);
    fireEvent.click(img);
    fireEvent.change(screen.getByPlaceholderText(/add comment here/i), {
      target: { value: "Fix the header" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    await waitFor(() => expect(screen.getByText("Ravi Rajput")).toBeTruthy());
  });
});
