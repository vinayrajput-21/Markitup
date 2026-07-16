import { describe, it, expect, vi } from "vitest";

const resetMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: { resetPasswordForEmail: resetMock },
  }),
}));

describe("requestPasswordReset", () => {
  it("returns a neutral sent state and calls Supabase with a redirect", async () => {
    const { requestPasswordReset } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "ravi@x.com");
    const res = await requestPasswordReset({}, fd);
    expect(res.sent).toBe(true);
    expect(resetMock).toHaveBeenCalledWith(
      "ravi@x.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/auth/callback") }),
    );
    const redirectTo = resetMock.mock.calls[0][1].redirectTo;
    expect(redirectTo).toContain("reset-password");
  });
});
