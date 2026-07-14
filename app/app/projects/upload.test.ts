import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("uploadMockup", () => {
  it("rejects a non-image file before touching storage", async () => {
    const { uploadMockup } = await import("./[projectId]/actions");
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.gif", { type: "image/gif" }));
    const result = await uploadMockup("proj1", fd);
    expect(result.error).toBe("Only PNG and JPG images are supported.");
  });
});
