"use client";

import { useEffect, useRef, useState } from "react";

// Kebab (⋯) button + dropdown used on project and file cards. Renders its items
// via a render prop so each caller can compose its own actions (and inline
// confirm / share state). `onClose` fires whenever the menu closes so callers
// can reset any transient state (e.g. a delete-confirm step).
export function CardMenu({
  label,
  onClose,
  openUp = false,
  children,
}: {
  label: string;
  onClose?: () => void;
  openUp?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  function close() {
    setOpen(false);
    onClose?.();
  }

  // Close on any click outside the menu (a fixed backdrop can't be used here —
  // the card's hover-transform + overflow-hidden would trap it to the card) or
  // on Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
        // Swallow the click this outside-press produces, so dismissing the menu
        // doesn't also navigate the card / trigger the thing underneath.
        const swallow = (ce: Event) => {
          ce.preventDefault();
          ce.stopPropagation();
          document.removeEventListener("click", swallow, true);
        };
        document.addEventListener("click", swallow, true);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        className="grid h-7 w-7 place-items-center rounded-md bg-surface/70 text-muted backdrop-blur transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="5" cy="12" r="1.6" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
          <circle cx="19" cy="12" r="1.6" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className={`absolute right-0 z-50 w-48 overflow-hidden rounded-lg border bg-surface-2 p-1 shadow-lg ${openUp ? "bottom-full mb-1" : "mt-1"}`}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function LinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 12a3 3 0 0 1 3-3h5a3 3 0 1 1 0 6h-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15 12a3 3 0 0 1-3 3H7a3 3 0 1 1 0-6h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 15V4m0 0-4 4m4-4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
export function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuItem({
  onClick,
  danger = false,
  disabled = false,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.preventDefault(); onClick(); }}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-[color:var(--accent)] disabled:pointer-events-none disabled:opacity-50"
      style={danger ? { color: "var(--color-danger)" } : undefined}
    >
      {children}
    </button>
  );
}
