"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { AuthShell, AuthLink } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, {});
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<>Remembered it? <AuthLink href="/login">Back to log in</AuthLink></>}
    >
      {state.sent ? (
        <p className="text-sm text-muted" role="status">
          If an account exists for that email, a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="you@agency.com" required className="field" />
          </div>
          {state.error && (
            <p className="text-sm font-medium" style={{ color: "var(--color-danger)" }} role="alert">{state.error}</p>
          )}
          <button type="submit" disabled={pending} className="btn-primary mt-1 w-full disabled:opacity-70">
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
