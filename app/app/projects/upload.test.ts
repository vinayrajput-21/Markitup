import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: {
      from: () => ({
        createSignedUploadUrl: async () => ({
          data: { path: "proj1/abc.png", token: "tok" },
          error: null,
        }),
      }),
    },
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

describe("createMockupUploadUrl", () => {
  it("rejects a non-image type before issuing a token", async () => {
    const { createMockupUploadUrl } = await import("./[projectId]/actions");
    const result = await createMockupUploadUrl("proj1", "image/gif");
    expect(result.error).toBe("Only PNG and JPG images are supported.");
  });

  it("returns a signed upload target for an image type", async () => {
    const { createMockupUploadUrl } = await import("./[projectId]/actions");
    const result = await createMockupUploadUrl("proj1", "image/png");
    expect(result.path).toBe("proj1/abc.png");
    expect(result.token).toBe("tok");
  });
});

describe("finalizeMockup", () => {
  it("rejects a path outside the project's folder", async () => {
    const { finalizeMockup } = await import("./[projectId]/actions");
    const result = await finalizeMockup("proj1", "otherproj/abc.png", "a.png");
    expect(result.error).toBe("Invalid upload path.");
  });

  it("records a mockup for a path inside the project's folder", async () => {
    const { finalizeMockup } = await import("./[projectId]/actions");
    const result = await finalizeMockup("proj1", "proj1/abc.png", "a.png");
    expect(result.error).toBeUndefined();
  });
});
