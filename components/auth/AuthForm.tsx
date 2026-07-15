"use client";

import { useActionState } from "react";

type AuthState = { error?: string };

export function AuthForm({
  action,
  next,
  submitLabel,
  children,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {children}
      {state?.error && (
        <p
          className="text-sm font-medium"
          style={{ color: "var(--color-danger)" }}
          role="alert"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-1 w-full disabled:opacity-70"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
