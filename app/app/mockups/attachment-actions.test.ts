import { describe, it, expect, vi, beforeEach } from "vitest";

const createSignedUploadUrl = vi.fn().mockResolvedValue({ data: { path: "p1/x.png", token: "tok" }, error: null });
const rpc = vi.fn(async () => ({ data: true }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc,
    storage: { from: () => ({ createSignedUploadUrl }) },
  }),
}));

describe("createAttachmentUploadUrl", () => {
  beforeEach(() => {
    createSignedUploadUrl.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: true });
  });

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
  it("refuses to sign when the caller cannot see the project", async () => {
    rpc.mockResolvedValue({ data: false });
    const { createAttachmentUploadUrl } = await import("./[mockupId]/attachment-actions");
    const res = await createAttachmentUploadUrl("p1", "image/png");
    expect(res.error).toBeTruthy();
    expect(res.path).toBeUndefined();
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
