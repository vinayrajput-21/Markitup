import { describe, it, expect, vi } from "vitest";

const updateEq = vi.fn().mockResolvedValue({ error: null });
const authUpdate = vi.fn().mockResolvedValue({ error: null });
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      updateUser: authUpdate,
    },
    from: () => ({ update: () => ({ eq: updateEq }) }),
  }),
}));

describe("updateProfileName", () => {
  it("rejects an empty name", async () => {
    const { updateProfileName } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "   ");
    const res = await updateProfileName(fd);
    expect(res.error).toBeTruthy();
  });

  it("updates profiles.name and auth metadata on a valid name", async () => {
    const { updateProfileName } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "Ravi Rajput");
    const res = await updateProfileName(fd);
    expect(res.error).toBeUndefined();
    expect(updateEq).toHaveBeenCalled();
    expect(authUpdate).toHaveBeenCalledWith({ data: { name: "Ravi Rajput" } });
  });
});
