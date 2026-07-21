"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type CompareMockup = { id: string; name: string; url: string; version?: number };

function label(m?: CompareMockup) {
  if (!m) return "";
  return m.version ? `Version ${m.version}` : m.name;
}

const CompareIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
    <rect x="13" y="4" width="8" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

// ---- Side-by-side (classic) ----------------------------------------------
function Panel({
  value,
  onChange,
  mockups,
  scrollRef,
  onScroll,
  side,
}: {
  value: string;
  onChange: (id: string) => void;
  mockups: CompareMockup[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  side: "Previous" | "Latest";
}) {
  const m = mockups.find((x) => x.id === value);
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-soft text-brand-ink" title="Comparison view">
          <CompareIcon />
        </span>
        <span className="shrink-0 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">{side}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="field h-8 min-w-0 flex-1 text-sm">
          {mockups.map((x) => (
            <option key={x.id} value={x.id}>{label(x)} · {x.name}</option>
          ))}
        </select>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto bg-canvas p-4">
        {m?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.name} className="mx-auto block w-full rounded-lg shadow-lg ring-1 ring-border" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-faint">No preview.</div>
        )}
      </div>
    </div>
  );
}

export function CompareView({
  mockups,
  initialLeft,
  initialRight,
  projectId,
  projectName,
}: {
  mockups: CompareMockup[];
  initialLeft: string; // previous / old
  initialRight: string; // latest / new
  projectId: string;
  projectName: string;
}) {
  const [mode, setMode] = useState<"overlay" | "side">("overlay");
  const [newId, setNewId] = useState(initialRight);
  const [oldId, setOldId] = useState(initialLeft);
  const [peek, setPeek] = useState(false);
  const [synced, setSynced] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const newM = mockups.find((m) => m.id === newId);
  const oldM = mockups.find((m) => m.id === oldId);

  // Hold Space to peek at the old version (ignored while a form control is focused).
  useEffect(() => {
    if (mode !== "overlay") return;
    const isField = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !isField(e.target)) { e.preventDefault(); setPeek(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); setPeek(false); } };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      setPeek(false);
    };
  }, [mode]);

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  }

  const ModeToggle = (
    <div className="flex overflow-hidden rounded-md border">
      <button
        onClick={() => setMode("overlay")}
        className="px-2.5 py-1 text-xs font-semibold transition-colors"
        style={mode === "overlay" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
      >
        Overlay
      </button>
      <button
        onClick={() => setMode("side")}
        className="border-l px-2.5 py-1 text-xs font-semibold transition-colors"
        style={mode === "side" ? { background: "var(--primary)", color: "var(--primary-foreground)" } : { color: "var(--muted-foreground)" }}
      >
        Side by side
      </button>
    </div>
  );

  // side-by-side synced scroll
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  function sync(from: "l" | "r") {
    if (!synced || lock.current) return;
    const src = (from === "l" ? leftRef : rightRef).current;
    const dst = (from === "l" ? rightRef : leftRef).current;
    if (!src || !dst) return;
    lock.current = true;
    const ry = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    const rx = src.scrollLeft / Math.max(1, src.scrollWidth - src.clientWidth);
    dst.scrollTop = ry * (dst.scrollHeight - dst.clientHeight);
    dst.scrollLeft = rx * (dst.scrollWidth - dst.clientWidth);
    requestAnimationFrame(() => { lock.current = false; });
  }

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-canvas">
      {/* one minimal header: back · title · controls */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-surface px-3">
        <Link
          href={`/app/projects/${projectId}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
          aria-label="Back to project"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="truncate text-sm font-bold text-ink">Compare · {projectName}</h1>

        <div className="ml-auto flex items-center gap-2">
          {mode === "overlay" && (
            <button
              onPointerDown={(e) => { e.preventDefault(); setPeek(true); }}
              onPointerUp={() => setPeek(false)}
              onPointerLeave={() => setPeek(false)}
              className="btn-secondary btn-sm select-none gap-1.5"
              title="Hold (or press Space) to see the old version"
            >
              <CompareIcon />
              {peek ? "Showing old…" : "Hold to compare"}
            </button>
          )}
          {mode === "side" && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted">
              <input type="checkbox" checked={synced} onChange={(e) => setSynced(e.target.checked)} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
              Sync scroll
            </label>
          )}
          <button onClick={toggleFull} aria-label="Fullscreen" title="Fullscreen" className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {ModeToggle}
        </div>
      </header>

      {mode === "overlay" ? (
        <div className="min-h-0 flex-1 overflow-auto bg-canvas p-3">
          {/* full-size: fills the available width, same as the normal viewer */}
          <div className="relative mx-auto w-full">
            {newM?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={newM.url} alt="" className="block w-full rounded-lg shadow-lg ring-1 ring-border" style={{ opacity: peek ? 0 : 1 }} />
            )}
            {oldM?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={oldM.url} alt="" className="absolute inset-x-0 top-0 block w-full rounded-lg shadow-lg ring-1 ring-border" style={{ opacity: peek ? 1 : 0 }} />
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
          <Panel side="Previous" value={oldId} onChange={setOldId} mockups={mockups} scrollRef={leftRef} onScroll={() => sync("l")} />
          <Panel side="Latest" value={newId} onChange={setNewId} mockups={mockups} scrollRef={rightRef} onScroll={() => sync("r")} />
        </div>
      )}
    </div>
  );
}
