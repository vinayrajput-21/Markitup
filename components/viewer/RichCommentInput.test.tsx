import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RichCommentInput } from "./RichCommentInput";

describe("RichCommentInput", () => {
  it("submits the typed HTML", () => {
    const onSubmit = vi.fn();
    render(<RichCommentInput onSubmit={onSubmit} projectId="p1" placeholder="Add comment here…" />);
    const box = screen.getByRole("textbox");
    box.innerHTML = "<b>hello</b>";
    fireEvent.input(box);
    fireEvent.click(screen.getByRole("button", { name: /^comment$/i }));
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][0]).toContain("hello");
  });

  it("exposes formatting controls", () => {
    render(<RichCommentInput onSubmit={vi.fn()} projectId="p1" />);
    expect(screen.getByRole("button", { name: /bold/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /bullet/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /link/i })).toBeTruthy();
  });
});
