import { describe, it, expect, vi } from "vitest";

const createSignedUploadUrl = vi.fn().mockResolvedValue({ data: { path: "p1/x.png", token: "tok" }, error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ createSignedUploadUrl }) },
  }),
}));

describe("createAttachmentUploadUrl", () => {
  it("rejects a disallowed type", async () => {
    const { createAttachmentUploadUrl } = await import("./[mockupId]/attachment-actions");
    expect((await createAttachmentUploadUrl("p1", "image/gif")).error).toBeTruthy();
  });
  it("returns a signed target for an image", async () => {
    const { createAttachmentUploadUrl } = await import("./[mockupId]/attachment-actions");
    const res = await createAttachmentUploadUrl("p1", "image/png");
    expect(res.path).toBe("p1/x.png");
    expect(res.token).toBe("tok");
  });
});
