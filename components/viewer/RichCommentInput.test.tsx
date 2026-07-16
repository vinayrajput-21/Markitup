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
    expect(screen.getByRole("button", { name: /attach/i })).toBeTruthy();
  });

  it("inserts pasted HTML as plain text only, never as markup", () => {
    render(<RichCommentInput onSubmit={vi.fn()} projectId="p1" />);
    const box = screen.getByRole("textbox");
    const clipboardData = {
      items: [] as unknown as DataTransferItemList,
      files: [] as unknown as FileList,
      getData: (type: string) => (type === "text/plain" ? '<img src=x onerror="alert(1)">evil' : ""),
    };
    fireEvent.paste(box, { clipboardData });
    // The raw markup must never be parsed into the editor DOM...
    expect(box.innerHTML).not.toContain("<img");
    expect(box.querySelector("img")).toBeNull();
    // ...only its literal text should appear.
    expect(box.textContent).toContain('<img src=x onerror="alert(1)">evil');
  });
});
