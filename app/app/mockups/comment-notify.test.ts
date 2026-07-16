import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Supabase mock: author is u1; workspace has u1 (author) + u2; project has u3.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Author" }, email: "author@x.com" } } }) },
    from: (table: string) => {
      if (table === "comments") return { insert: async () => ({ error: null }) };
      if (table === "mockups") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "Homepage", project_id: "p1", projects: { workspace_id: "w1" } } }) }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: async () => ({ data: [
          { profiles: { id: "u1", name: "Author", email: "author@x.com" } },
          { profiles: { id: "u2", name: "Teammate", email: "team@x.com" } },
        ] }) }),
      };
      if (table === "project_members") return {
        select: () => ({ eq: async () => ({ data: [
          { profiles: { id: "u3", name: "Client", email: "client@x.com" } },
        ] }) }),
      };
      return { select: () => ({ eq: async () => ({ data: [] }) }) };
    },
  }),
}));

describe("addComment notifications", () => {
  beforeEach(() => sendEmail.mockClear());

  it("emails every member except the author", async () => {
    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "Please fix the header");
    const recipients = sendEmail.mock.calls.map((c) => c[0].to).sort();
    expect(recipients).toEqual(["client@x.com", "team@x.com"]);
  });
});
