import { describe, it, expect, vi } from "vitest";

// revalidatePath needs a Next.js request-scoped store that doesn't exist
// under vitest; mock it the same way this repo already mocks next/navigation
// in app/auth/actions.test.ts.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "profiles" ? { data: null } : { data: null },
          limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "ws1", workspaces: { id: "ws1", name: "W" } } }) }),
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  }),
}));

describe("addMemberByEmail", () => {
  it("creates an invitation when the email has no profile", async () => {
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const result = await addMemberByEmail(fd);
    expect(result.invited).toBe(true);
  });
});
