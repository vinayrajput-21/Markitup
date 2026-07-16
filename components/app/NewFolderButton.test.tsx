import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { createFolder } = vi.hoisted(() => ({
  createFolder: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/app/folders-actions", () => ({ createFolder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { NewFolderButton } from "./NewFolderButton";

describe("NewFolderButton", () => {
  it("creates a folder from the inline input", async () => {
    render(<NewFolderButton />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.change(screen.getByPlaceholderText(/folder name/i), { target: { value: "Client work" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    await waitFor(() => {
      expect(createFolder).toHaveBeenCalled();
      const fd = createFolder.mock.calls[0][0] as FormData;
      expect(fd.get("name")).toBe("Client work");
    });
  });
});
