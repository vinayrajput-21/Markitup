"use client";

import { useFormStatus } from "react-dom";

// Submit button that shows a spinner + pending label while its parent <form>'s
// server action is in flight. Must be rendered inside a <form>.
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
