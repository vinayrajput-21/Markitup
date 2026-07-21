"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Variant = "success" | "error" | "info" | "loading";

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: Variant;
  duration?: number; // ms; 0 = sticky (until dismissed/updated)
  progress?: number; // 0..1 → renders a determinate bar; omit for indeterminate on `loading`
};

type ToastItem = ToastOptions & { id: number; variant: Variant; leaving?: boolean };

type ToastApi = {
  push: (o: ToastOptions) => number;
  update: (id: number, patch: Partial<ToastOptions>) => void;
  dismiss: (id: number) => void;
  success: (title: string, o?: Partial<ToastOptions>) => number;
  error: (title: string, o?: Partial<ToastOptions>) => number;
  info: (title: string, o?: Partial<ToastOptions>) => number;
};

const ToastCtx = createContext<ToastApi | null>(null);

// No-op fallback so components can call useToast() even if rendered outside the
// provider (e.g. in unit tests). The provider is mounted at the app root in
// production, so real usage always hits the live implementation.
const NOOP: ToastApi = {
  push: () => 0,
  update: () => {},
  dismiss: () => {},
  success: () => 0,
  error: () => 0,
  info: () => 0,
};

export function useToast(): ToastApi {
  return useContext(ToastCtx) ?? NOOP;
}

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((x) => x.id !== id));
  }, []);

  const dismiss = useCallback((id: number) => {
    clearTimer(id);
    // play the leave animation, then unmount
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => remove(id), 200);
  }, [clearTimer, remove]);

  const schedule = useCallback((id: number, duration: number) => {
    clearTimer(id);
    if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [clearTimer, dismiss]);

  const push = useCallback((o: ToastOptions) => {
    const id = ++counter;
    const variant = o.variant ?? "info";
    const duration = o.duration ?? (variant === "loading" ? 0 : 3500);
    setToasts((ts) => [...ts, { ...o, id, variant }]);
    schedule(id, duration);
    return id;
  }, [schedule]);

  const update = useCallback((id: number, patch: Partial<ToastOptions>) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const nextVariant = patch.variant;
    if (patch.duration !== undefined) {
      schedule(id, patch.duration);
    } else if (nextVariant && nextVariant !== "loading") {
      schedule(id, 3500);
    }
  }, [schedule]);

  const success = useCallback((title: string, o?: Partial<ToastOptions>) => push({ title, variant: "success", ...o }), [push]);
  const error = useCallback((title: string, o?: Partial<ToastOptions>) => push({ title, variant: "error", ...o }), [push]);
  const info = useCallback((title: string, o?: Partial<ToastOptions>) => push({ title, variant: "info", ...o }), [push]);

  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); t.clear(); };
  }, []);

  return (
    <ToastCtx.Provider value={{ push, update, dismiss, success, error, info }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastCard key={t.id} t={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ t, onClose }: { t: ToastItem; onClose: () => void }) {
  const tone = TONES[t.variant];
  const determinate = typeof t.progress === "number";
  return (
    <div
      data-leaving={t.leaving ? "true" : undefined}
      role="status"
      aria-live={t.variant === "error" ? "assertive" : "polite"}
      className="toast-card overflow-hidden rounded-xl border bg-surface-2 shadow-lg"
    >
      <div className="flex items-start gap-3 p-3 pr-2.5">
        <span
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full"
          style={{ background: tone.soft, color: tone.fg }}
        >
          {t.variant === "loading" ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          ) : (
            <span aria-hidden>{tone.icon}</span>
          )}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold text-ink">{t.title}</p>
          {t.description && <p className="mt-0.5 text-xs text-muted">{t.description}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {(t.variant === "loading" || determinate) && (
        <div className="h-1 w-full overflow-hidden bg-[color:var(--color-brand-soft)]">
          {determinate ? (
            <div
              className="h-full rounded-r-full transition-[width] duration-200"
              style={{ width: `${Math.round((t.progress ?? 0) * 100)}%`, background: tone.fg }}
            />
          ) : (
            <div className="bar-sweep h-full w-1/3 rounded-full" style={{ background: tone.fg }} />
          )}
        </div>
      )}
    </div>
  );
}

const TONES: Record<Variant, { fg: string; soft: string; icon: React.ReactNode }> = {
  success: {
    fg: "var(--color-success)",
    soft: "var(--color-success-soft)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  error: {
    fg: "var(--color-danger)",
    soft: "var(--color-danger-soft)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M12 8v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  info: {
    fg: "var(--color-brand)",
    soft: "var(--color-brand-soft)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <path d="M12 11v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  loading: { fg: "var(--color-brand)", soft: "var(--color-brand-soft)", icon: null },
};
