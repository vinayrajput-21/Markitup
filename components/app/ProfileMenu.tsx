"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "./AppSidebar";
import { signOut } from "@/app/auth/actions";

export function ProfileMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className="flex rounded-full ring-2 ring-transparent transition hover:ring-[color:var(--color-border-strong)]"
      >
        <Avatar name={name} email={email} size={32} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-surface-2 shadow-lg">
            <div className="border-b px-3 py-2.5">
              <p className="truncate text-sm font-semibold text-ink">{name || "Your account"}</p>
              <p className="truncate text-xs text-faint">{email}</p>
            </div>
            <Link
              href="/app/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              Your Profile
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 12H4m0 0 4-4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
