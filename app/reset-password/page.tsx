"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabase();
    // Supabase established a recovery session from the link's tokens on load.
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app");
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter a new password for your account."
      footer={<>Changed your mind? <AuthLink href="/login">Back to log in</AuthLink></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="field-label">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 6 characters"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </div>
        {error && (
          <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{error}</p>
        )}
        <button type="submit" disabled={pending} className="btn-primary mt-1 w-full disabled:opacity-70">
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
