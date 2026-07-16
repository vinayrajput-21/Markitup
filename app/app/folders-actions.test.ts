import { describe, it, expect, vi, beforeEach } from "vitest";

const updateEq = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    from: () => ({ update: () => ({ eq: updateEq }) }),
  }),
}));

beforeEach(() => updateEq.mockClear());

describe("archive actions", () => {
  it("archiveProject sets archived_at; unarchive clears it", async () => {
    const { archiveProject, unarchiveProject } = await import("./folders-actions");
    expect((await archiveProject("p1")).error).toBeUndefined();
    expect((await unarchiveProject("p1")).error).toBeUndefined();
    expect(updateEq).toHaveBeenCalledTimes(2);
  });
});
