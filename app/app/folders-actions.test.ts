import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn().mockResolvedValue({ error: null });
const updateEq = vi.fn().mockResolvedValue({ error: null });
const deleteEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("./actions", () => ({ getCurrentWorkspace: async () => ({ id: "ws1", name: "W" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert,
      update: () => ({ eq: updateEq }),
      delete: () => ({ eq: deleteEq }),
    }),
  }),
}));

beforeEach(() => { insert.mockClear(); updateEq.mockClear(); deleteEq.mockClear(); });

describe("folders-actions", () => {
  it("createFolder rejects an empty name", async () => {
    const { createFolder } = await import("./folders-actions");
    const fd = new FormData();
    fd.set("name", "  ");
    expect((await createFolder(fd)).error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("createFolder inserts with the workspace + user", async () => {
    const { createFolder } = await import("./folders-actions");
    const fd = new FormData();
    fd.set("name", "Client work");
    expect((await createFolder(fd)).error).toBeUndefined();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Client work", workspace_id: "ws1", created_by: "u1" }),
    );
  });

  it("moveProjectToFolder updates the project's folder_id", async () => {
    const { moveProjectToFolder } = await import("./folders-actions");
    expect((await moveProjectToFolder("p1", "f1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalled();
  });

  it("archiveProject sets archived_at; unarchive clears it", async () => {
    const { archiveProject, unarchiveProject } = await import("./folders-actions");
    expect((await archiveProject("p1")).error).toBeUndefined();
    expect((await unarchiveProject("p1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalledTimes(2);
  });

  it("deleteFolder deletes by id", async () => {
    const { deleteFolder } = await import("./folders-actions");
    expect((await deleteFolder("f1")).error).toBeUndefined();
    expect(deleteEq).toHaveBeenCalled();
  });
});
