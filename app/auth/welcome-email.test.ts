import { describe, it, expect, vi } from "vitest";

const sendEmail = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/email/send", () => ({ sendEmail, EMAIL_FROM: "x" }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { signUp: async () => ({ error: null }) },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

describe("signUp welcome email", () => {
  it("attempts a welcome email after a successful signup", async () => {
    const { signUp } = await import("./actions");
    const fd = new FormData();
    fd.set("name", "Ravi");
    fd.set("email", "ravi@x.com");
    fd.set("password", "password123");
    await expect(signUp(fd)).rejects.toThrow("REDIRECT");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "ravi@x.com" });
  });
});
