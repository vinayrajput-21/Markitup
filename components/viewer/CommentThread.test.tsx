import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CommentThread } from "./CommentThread";

vi.mock("@/app/app/mockups/[mockupId]/actions", () => ({
  addComment: async () => ({}),
  setPinStatus: async () => ({}),
}));

describe("CommentThread", () => {
  it("adds a top-level comment to the thread on submit", async () => {
    const onChange = vi.fn();
    render(
      <CommentThread
        mockupId="m1"
        pin={{ id: "p1", x: 0.5, y: 0.5, number: 1, status: "active", comments: [] }}
        members={[]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: "Looks off here" },
    });
    fireEvent.click(screen.getByText("Comment"));
    await waitFor(() => expect(screen.getByText("Looks off here")).toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
  });
});
