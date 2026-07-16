"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toNormalized } from "@/lib/coords";
import { PinMarker } from "./PinMarker";
import { PinComposer } from "./PinComposer";
import { CommentThread, type Member } from "./CommentThread";
import { CommentFilter, type Filter } from "./CommentFilter";
import { createPin, addComment } from "@/app/app/mockups/[mockupId]/actions";
import { timeAgo } from "@/lib/format";

export type ViewerComment = {
  id: string;
  body: string;
  authorName: string;
  parentCommentId: string | null;
  createdAt: string;
};
export type ViewerPin = {
  id: string;
  x: number;
  y: number;
  number: number;
  status: "active" | "resolved";
  comments: ViewerComment[];
};

type Sibling = { id: string };
type Zoom = { mode: "fit-window" | "fit-width" | "percent"; pct: number };

const ZOOM_OPTIONS: { label: string; value: Zoom }[] = [
  { label: "Fit in window", value: { mode: "fit-window", pct: 0 } },
  { label: "Fit horizontally", value: { mode: "fit-width", pct: 0 } },
  ...[25, 50, 75, 100, 125, 150, 175, 200].map((p) => ({
    label: `${p}%`,
    value: { mode: "percent" as const, pct: p },
  })),
];

const SORTS = [
  { key: "pins", label: "Pin order" },
  { key: "newest", label: "Latest activity" },
  { key: "oldest", label: "Oldest first" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function latestAt(p: ViewerPin) {
  return p.comments.reduce((m, c) => (c.createdAt > m ? c.createdAt : m), "");
}

function PinListItem({ pin, onSelect }: { pin: ViewerPin; onSelect: () => void }) {
  const first = pin.comments.find((c) => !c.parentCommentId);
  const resolved = pin.status === "resolved";
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[color:var(--accent)]"
    >
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold"
        style={{
          background: resolved ? "var(--success)" : "var(--primary)",
          color: resolved ? "#fff" : "var(--primary-foreground)",
        }}
      >
        {pin.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {first ? first.authorName : "Empty pin"}
          </span>
          {first && (
            <span className="shrink-0 font-mono text-[0.6875rem] text-faint">{timeAgo(first.createdAt)}</span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
          {first ? first.body : "No comment yet"}
        </span>
        {pin.comments.length > 1 && (
          <span className="mt-1 block font-mono text-[0.6875rem] text-faint">{pin.comments.length} messages</span>
        )}
      </span>
    </button>
  );
}

function ToolbarButton({
  onClick,
  label,
  children,
  disabled,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-[color:var(--accent)] hover:text-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function MockupViewer({
  mockupId,
  imageUrl,
  imageName,
  initialPins,
  siblings,
  members,
  currentUserName,
}: {
  mockupId: string;
  imageUrl: string;
  imageName: string;
  initialPins: ViewerPin[];
  siblings: Sibling[];
  members: Member[];
  currentUserName: string;
}) {
  const [pins, setPins] = useState<ViewerPin[]>(initialPins);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("pins");
  const [sortOpen, setSortOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState<Zoom>({ mode: "fit-width", pct: 0 });
  const [zoomOpen, setZoomOpen] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number; pinId?: string; number?: number } | null>(null);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState({ w: 0, h: 0 });

  // track the scroll container size
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // displayed width of the image for the current zoom mode
  const displayW = useMemo(() => {
    if (!nat.w || !box.w) return 0;
    const pad = 48; // matches p-6 on both sides
    const availW = Math.max(0, box.w - pad);
    const availH = Math.max(0, box.h - pad);
    if (zoom.mode === "fit-width") return availW;
    if (zoom.mode === "fit-window") {
      const scale = Math.min(availW / nat.w, availH / nat.h);
      return nat.w * scale;
    }
    return nat.w * (zoom.pct / 100);
  }, [nat, box, zoom]);

  const shownPct = nat.w && displayW ? Math.round((displayW / nat.w) * 100) : null;
  const zoomLabel =
    zoom.mode === "fit-window"
      ? "Fit in window"
      : zoom.mode === "fit-width"
        ? "Fit horizontally"
        : `${zoom.pct}%`;

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toNormalized(e.clientX, e.clientY, rect);
    setActivePinId(null);
    setPinError(null);
    setDraft({ x, y });
  }

  async function saveDraft(body: string) {
    if (!draft) return;
    setSavingPin(true);
    setPinError(null);
    try {
      let pinId = draft.pinId;
      let number = draft.number;
      if (!pinId) {
        const res = await createPin(mockupId, draft.x, draft.y);
        if (res.error || !res.id || res.number == null) {
          setPinError(res.error || "Could not save your comment. Please try again.");
          return;
        }
        pinId = res.id;
        number = res.number;
        // remember the created pin so a retry doesn't create a duplicate
        setDraft((d) => (d ? { ...d, pinId, number } : d));
      }
      const cRes = await addComment(mockupId, pinId, body);
      if (cRes.error) {
        setPinError(cRes.error);
        return;
      }
      setPins((p) => [
        ...p,
        {
          id: pinId!,
          x: draft.x,
          y: draft.y,
          number: number!,
          status: "active",
          comments: [
            // Render only the server-sanitized HTML, never the raw editor input.
            { id: `tmp-${pinId}`, body: cRes.body ?? "", authorName: currentUserName, parentCommentId: null, createdAt: new Date().toISOString() },
          ],
        },
      ]);
      setDraft(null);
    } catch {
      setPinError("Something went wrong. Please try again.");
    } finally {
      setSavingPin(false);
    }
  }

  async function download() {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = imageName || "mockup";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(imageUrl, "_blank");
    }
  }

  function toggleFullscreen() {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const counts = {
    all: pins.length,
    active: pins.filter((p) => p.status === "active").length,
    resolved: pins.filter((p) => p.status === "resolved").length,
  };
  const q = query.trim().toLowerCase();
  const visiblePins = pins
    .filter((p) => (filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved"))
    .filter((p) =>
      !q
        ? true
        : String(p.number) === q ||
          p.comments.some((c) => c.body.toLowerCase().includes(q) || c.authorName.toLowerCase().includes(q)),
    )
    .sort((a, b) => {
      if (sort === "pins") return a.number - b.number;
      if (sort === "newest") return latestAt(b).localeCompare(latestAt(a));
      return latestAt(a).localeCompare(latestAt(b));
    });
  const activePin = pins.find((p) => p.id === activePinId) ?? null;

  const idx = siblings.findIndex((s) => s.id === mockupId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <div className="flex h-full min-h-0">
      {/* comment rail */}
      <aside className="flex w-[344px] shrink-0 flex-col border-r bg-surface">
        {activePin ? (
          <CommentThread
            mockupId={mockupId}
            pin={activePin}
            members={members}
            currentUserName={currentUserName}
            onBack={() => setActivePinId(null)}
            onChange={(updated) => setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))}
          />
        ) : (
          <>
            <div className="border-b p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Comments</h2>
                <div className="flex items-center gap-0.5">
                  {/* sort */}
                  <div className="relative">
                    <ToolbarButton label="Sort" onClick={() => { setSortOpen((o) => !o); setSearchOpen(false); }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </ToolbarButton>
                    {sortOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />
                        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-surface-2 p-1 shadow-lg">
                          {SORTS.map((s) => (
                            <button
                              key={s.key}
                              onClick={() => { setSort(s.key); setSortOpen(false); }}
                              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:bg-[color:var(--accent)]"
                            >
                              {s.label}
                              {sort === s.key && (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-brand" aria-hidden>
                                  <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {/* search */}
                  <ToolbarButton label="Search comments" onClick={() => { setSearchOpen((o) => !o); setSortOpen(false); }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
                      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </ToolbarButton>
                </div>
              </div>
              {searchOpen && (
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search comments…"
                  className="field mb-3 h-9"
                />
              )}
              <CommentFilter value={filter} onChange={setFilter} counts={counts} />
            </div>
            <div className="flex-1 divide-y overflow-y-auto">
              {visiblePins.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-ink">
                    {counts.all === 0 ? "No comments yet" : "Nothing here"}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    {counts.all === 0
                      ? "Click anywhere on the design to drop your first pin."
                      : q
                        ? "No comments match your search."
                        : "Try a different filter."}
                  </p>
                </div>
              ) : (
                visiblePins.map((p) => <PinListItem key={p.id} pin={p} onSelect={() => setActivePinId(p.id)} />)
              )}
            </div>
          </>
        )}
      </aside>

      {/* canvas + toolbar */}
      <div ref={canvasRef} className="flex min-w-0 flex-1 flex-col bg-canvas">
        {/* canvas toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-surface px-3 py-2">
          <span className="hidden font-mono text-xs text-faint md:inline">{shownPct ? `${shownPct}%` : ""}</span>

          {/* pagination */}
          <div className="flex items-center gap-1">
            {prev ? (
              <Link href={`/app/mockups/${prev.id}`} className="btn-secondary btn-sm gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Prev
              </Link>
            ) : (
              <span className="btn-secondary btn-sm pointer-events-none gap-1 opacity-40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Prev
              </span>
            )}
            <span className="px-2 font-mono text-xs text-muted">
              {idx >= 0 ? idx + 1 : 1} of {siblings.length || 1}
            </span>
            {next ? (
              <Link href={`/app/mockups/${next.id}`} className="btn-secondary btn-sm gap-1">
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            ) : (
              <span className="btn-secondary btn-sm pointer-events-none gap-1 opacity-40">
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            )}
          </div>

          {/* zoom + actions */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setZoomOpen((o) => !o)}
                className="btn-secondary btn-sm gap-1.5"
              >
                {zoomLabel}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {zoomOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setZoomOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border bg-surface-2 p-1 shadow-lg">
                    {ZOOM_OPTIONS.map((o) => {
                      const on = o.value.mode === zoom.mode && (o.value.mode !== "percent" || o.value.pct === zoom.pct);
                      return (
                        <button
                          key={o.label}
                          onClick={() => { setZoom(o.value); setZoomOpen(false); }}
                          className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-[color:var(--accent)]"
                          style={on ? { color: "var(--primary)", fontWeight: 600 } : { color: "var(--foreground)" }}
                        >
                          {o.label}
                          {on && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <ToolbarButton label="Download" onClick={download}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 4v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 18h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </ToolbarButton>
            <ToolbarButton label="Fullscreen" onClick={toggleFullscreen}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ToolbarButton>
          </div>
        </div>

        {/* scrollable image canvas */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            <div className="relative shrink-0" style={{ width: displayW || "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt="mockup"
                onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onClick={handleImageClick}
                draggable={false}
                className="block w-full cursor-crosshair rounded-lg shadow-lg ring-1 ring-border select-none"
              />
              {visiblePins.map((p) => (
                <PinMarker
                  key={p.id}
                  number={p.number}
                  x={p.x}
                  y={p.y}
                  status={p.status}
                  selected={p.id === activePinId}
                  onClick={() => setActivePinId(p.id)}
                />
              ))}
              {draft && (
                <PinComposer
                  xPct={draft.x * 100}
                  yPct={draft.y * 100}
                  pending={savingPin}
                  error={pinError}
                  onCancel={() => { setDraft(null); setPinError(null); }}
                  onSubmit={saveDraft}
                />
              )}
            </div>
          </div>

          {counts.all === 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <span
                className="rounded-full px-4 py-2 text-xs font-medium shadow-lg"
                style={{ background: "var(--foreground)", color: "var(--background)" }}
              >
                Click anywhere on the design to leave a comment
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
