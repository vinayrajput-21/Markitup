import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { moveProjectToFolder, archiveProject } = vi.hoisted(() => ({
  moveProjectToFolder: vi.fn().mockResolvedValue({}),
  archiveProject: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/app/app/folders-actions", () => ({ moveProjectToFolder, archiveProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ProjectCardMenu } from "./ProjectCardMenu";

describe("ProjectCardMenu", () => {
  it("archives via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" folders={[{ id: "f1", name: "Client" }]} currentFolderId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText(/archive/i));
    await waitFor(() => expect(archiveProject).toHaveBeenCalledWith("p1"));
  });

  it("moves to a folder via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" folders={[{ id: "f1", name: "Client" }]} currentFolderId={null} />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText("Client"));
    await waitFor(() => expect(moveProjectToFolder).toHaveBeenCalledWith("p1", "f1"));
  });
});
