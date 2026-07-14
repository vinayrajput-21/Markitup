import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

describe("createServerSupabase", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("builds a client exposing auth", async () => {
    const { createServerSupabase } = await import("./server");
    const client = await createServerSupabase();
    expect(client.auth).toBeDefined();
  });
});
