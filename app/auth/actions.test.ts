import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({
    auth: {
      signInWithPassword: async ({ email }: { email: string }) =>
        email === "bad@x.com"
          ? { error: { message: "Invalid login credentials" } }
          : { error: null },
    },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("REDIRECT"); } }));

describe("signIn", () => {
  it("returns an error message on bad credentials", async () => {
    const { signIn } = await import("./actions");
    const fd = new FormData();
    fd.set("email", "bad@x.com");
    fd.set("password", "nope");
    const result = await signIn(fd);
    expect(result?.error).toBe("Invalid login credentials");
  });
});
