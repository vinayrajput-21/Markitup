import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted so the (hoisted) vi.mock factory can read the per-scenario profile id.
const h = vi.hoisted(() => ({
  state: { profileId: null as string | null },
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  rpc: vi.fn(async (name: string) =>
    name === "find_profile_id_by_email" ? { data: h.state.profileId } : { error: null }
  ),
}));

vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Supabase mock covering only what inviteToProject touches:
//   mockupContext -> from("mockups").select(...).eq(...).maybeSingle()
//   auth.getUser()
//   rpc("find_profile_id_by_email") -> { data: profileId }
//   then from("project_members").insert() OR from("invitations").insert()
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Ravi" } } } }) },
    rpc: h.rpc, // null -> invitations path; id -> project_members path
    from: (table: string) => {
      if (table === "mockups") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { project_id: "p1", projects: { workspace_id: "w1", name: "Homepage", workspaces: { name: "Apexure" } } },
        }) }) }),
      };
      // project_members and invitations both only need insert() here.
      return { insert: async () => ({ error: null }) };
    },
  }),
}));

describe("inviteToProject invite email", () => {
  beforeEach(() => {
    h.sendEmail.mockClear();
    h.rpc.mockClear();
    h.state.profileId = null;
  });

  it("emails an existing member with a login link", async () => {
    h.state.profileId = "existing-user"; // -> project_members path, isNewUser: false
    const { inviteToProject } = await import("./[mockupId]/share-actions");
    const res = await inviteToProject("m1", "member@client.com");
    expect(res).toEqual({ invited: false });
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("member@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/login");
  });

  it("emails a brand-new invitee with a signup link", async () => {
    h.state.profileId = null; // -> invitations path, isNewUser: true
    const { inviteToProject } = await import("./[mockupId]/share-actions");
    const res = await inviteToProject("m1", "new@client.com");
    expect(res).toEqual({ invited: true });
    expect(h.sendEmail).toHaveBeenCalledOnce();
    expect(h.sendEmail.mock.calls[0][0].to).toBe("new@client.com");
    expect(h.sendEmail.mock.calls[0][0].html).toContain("/signup");
    expect(h.rpc.mock.calls.some((c) => c[0] === "create_notification")).toBe(false);
  });

  it("notifies an existing member when shared a mockup", async () => {
    h.state.profileId = "existing-user"; // -> project_members path
    const { inviteToProject } = await import("./[mockupId]/share-actions");
    await inviteToProject("m1", "member@client.com");
    expect(h.rpc.mock.calls).toContainEqual([
      "create_notification",
      expect.objectContaining({ p_user_id: "existing-user", p_type: "share" }),
    ]);
  });
});
