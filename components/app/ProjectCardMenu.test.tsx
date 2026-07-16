import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const archiveProject = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock("@/app/app/folders-actions", () => ({ archiveProject }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { ProjectCardMenu } from "./ProjectCardMenu";

describe("ProjectCardMenu", () => {
  it("archives via the menu", async () => {
    render(<ProjectCardMenu projectId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: /project options/i }));
    fireEvent.click(screen.getByText(/archive/i));
    await waitFor(() => expect(archiveProject).toHaveBeenCalledWith("p1"));
  });
});
