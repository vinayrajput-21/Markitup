import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Ravi" } } } }) },
    rpc: async () => ({ data: null }), // no existing profile -> invitation path
    from: (table: string) => {
      if (table === "workspaces") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "w1", name: "Apexure" } }) }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "w1", workspaces: { id: "w1", name: "Apexure" } } }) }) }) }),
      };
      return { insert: async () => ({ error: null }) };
    },
  }),
}));

describe("addMemberByEmail invite email", () => {
  beforeEach(() => sendEmail.mockClear());
  it("emails a brand-new invitee", async () => {
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].to).toBe("new@client.com");
  });
});
