import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted fixtures so the (hoisted) vi.mock factory can read mutable state per-scenario.
const h = vi.hoisted(() => {
  type Profile = { id: string; name: string; email: string };
  const state = {
    // whether the mockups lookup should throw (never-break test)
    mockupThrows: false,
    workspaceMembers: [] as { profiles: Profile }[],
    projectMembers: [] as { profiles: Profile }[],
  };
  const sendEmail = vi.fn().mockResolvedValue({ ok: true });
  const rpcMock = vi.fn().mockResolvedValue({ error: null });
  return { state, sendEmail, rpcMock };
});

vi.mock("@/lib/email/send", () => ({ sendEmail: h.sendEmail, EMAIL_FROM: "x" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

// Supabase mock: author is u1. Member lists are read live from the hoisted fixture so each
// test can swap in its own scenario before calling addComment.
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", user_metadata: { name: "Author" }, email: "author@x.com" } } }) },
    rpc: h.rpcMock,
    from: (table: string) => {
      if (table === "comments") return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }) }) };
      if (table === "mockups") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => {
          if (h.state.mockupThrows) throw new Error("mockup lookup failed");
          return { data: { name: "Homepage", project_id: "p1", projects: { workspace_id: "w1" } } };
        } }) }),
      };
      if (table === "workspace_members") return {
        select: () => ({ eq: async () => ({ data: h.state.workspaceMembers }) }),
      };
      if (table === "project_members") return {
        select: () => ({ eq: async () => ({ data: h.state.projectMembers }) }),
      };
      return { select: () => ({ eq: async () => ({ data: [] }) }) };
    },
  }),
}));

describe("addComment notifications", () => {
  beforeEach(() => {
    h.sendEmail.mockClear();
    h.rpcMock.mockClear();
    // Reset fixture to the default happy-path scenario before every test.
    h.state.mockupThrows = false;
    // workspace has u1 (author) + u2; project has u3.
    h.state.workspaceMembers = [
      { profiles: { id: "u1", name: "Author", email: "author@x.com" } },
      { profiles: { id: "u2", name: "Teammate", email: "team@x.com" } },
    ];
    h.state.projectMembers = [
      { profiles: { id: "u3", name: "Client", email: "client@x.com" } },
    ];
  });

  it("emails every member except the author", async () => {
    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "Please fix the header");
    const recipients = h.sendEmail.mock.calls.map((c) => c[0].to).sort();
    expect(recipients).toEqual(["client@x.com", "team@x.com"]);
  });

  it("sends plain text (no HTML tags) in the notification email body", async () => {
    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "<p>Please <b>fix</b> the header</p>");
    // The email templates escape their inputs; sending plain text means no
    // literal tag characters ever reach the recipient's rendered body.
    for (const call of h.sendEmail.mock.calls) {
      const { html, text } = call[0];
      expect(html).not.toContain("&lt;p&gt;");
      expect(html).not.toContain("&lt;b&gt;");
      expect(text).not.toContain("<p>");
      expect(text).not.toContain("<b>");
      expect(text).toContain("Please fix the header");
    }
  });

  it("de-dupes a member who is in both the workspace and the project (one email, not two)", async () => {
    // u2 (team@x.com) appears in BOTH lists; u3 (client@x.com) only in the project.
    h.state.workspaceMembers = [
      { profiles: { id: "u1", name: "Author", email: "author@x.com" } },
      { profiles: { id: "u2", name: "Teammate", email: "team@x.com" } },
    ];
    h.state.projectMembers = [
      { profiles: { id: "u2", name: "Teammate", email: "team@x.com" } },
      { profiles: { id: "u3", name: "Client", email: "client@x.com" } },
    ];

    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "Please fix the header");

    const recipients = h.sendEmail.mock.calls.map((c) => c[0].to).sort();
    // Unique non-author emails only.
    expect(recipients).toEqual(["client@x.com", "team@x.com"]);
    // Exactly N = number of unique non-author emails; the duplicated member is not emailed twice.
    expect(h.sendEmail).toHaveBeenCalledTimes(2);
    expect(new Set(recipients).size).toBe(recipients.length);
  });

  it("still returns the sanitized body (never throws, no error) when the recipient lookup fails", async () => {
    // Force the notification lookup to blow up; the comment insert itself still succeeds.
    h.state.mockupThrows = true;

    const { addComment } = await import("./[mockupId]/actions");
    const result = await addComment("m1", "pin1", "Please fix the header");

    // Success return carries the server-sanitized body (plain text here);
    // crucially no `error` and no throw despite the failed recipient lookup.
    expect(result).toEqual({ body: "Please fix the header" });
    expect(h.sendEmail).not.toHaveBeenCalled();
  });

  it("creates an in-app notification for each non-author recipient", async () => {
    const { addComment } = await import("./[mockupId]/actions");
    await addComment("m1", "pin1", "Please fix the header");
    const notified = h.rpcMock.mock.calls
      .filter((c) => c[0] === "create_notification")
      .map((c) => c[1].p_user_id)
      .sort();
    expect(notified).toEqual(["u2", "u3"]); // team + client, not the author u1
  });
});
