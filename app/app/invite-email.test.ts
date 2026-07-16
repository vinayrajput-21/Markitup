import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the (hoisted) vi.mock factory can read the per-scenario profile id.
const h = vi.hoisted(() => ({
  state: { profileId: null as string | null },
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Ravi" } } } }) },
    rpc: async () => ({ data: h.state.profileId }), // null -> invitation path; id -> workspace_members path
    from: (table: string) => {
      if (table === "workspaces") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "w1", name: "Apexure" } }) }) }),
      };
      if (table === "workspace_members") return {
        // select() feeds getCurrentWorkspace; insert() feeds the existing-member branch.
        select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { workspace_id: "w1", workspaces: { id: "w1", name: "Apexure" } } }) }) }) }),
        insert: async () => ({ error: null }),
      };
      return { insert: async () => ({ error: null }) };
    },
  }),
}));

describe("addMemberByEmail invite email", () => {
  beforeEach(() => {
    h.sendEmail.mockClear();
    h.state.profileId = null;
  });

  it("emails a brand-new invitee with a signup link", async () => {
    h.state.profileId = null; // no existing profile -> invitation path, isNewUser: true
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "new@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(true);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("new@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/signup");
  });

  it("emails an existing member with a login link", async () => {
    h.state.profileId = "existing-user"; // existing profile -> workspace_members path, isNewUser: false
    const { addMemberByEmail } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "member@client.com");
    const res = await addMemberByEmail(fd);
    expect(res.invited).toBe(false);
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("member@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/login");
  });
});
