"use client";

import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toNormalized } from "@/lib/coords";
import { PinMarker } from "./PinMarker";
import { CommentThread } from "./CommentThread";
import { CommentFilter, type Filter } from "./CommentFilter";
import { createPin } from "@/app/app/mockups/[mockupId]/actions";
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

function PinListItem({ pin, onSelect }: { pin: ViewerPin; onSelect: () => void }) {
  const first = pin.comments.find((c) => !c.parentCommentId);
  const resolved = pin.status === "resolved";
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-brand-soft/60"
    >
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold text-white"
        style={{ background: resolved ? "var(--color-success)" : "var(--color-brand)" }}
      >
        {pin.number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {first ? first.authorName : "Empty pin"}
          </span>
          {first && (
            <span className="shrink-0 font-mono text-[0.6875rem] text-faint">
              {timeAgo(first.createdAt)}
            </span>
          )}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
          {first ? first.body : "No comment yet"}
        </span>
        {pin.comments.length > 1 && (
          <span className="mt-1 block font-mono text-[0.6875rem] text-faint">
            {pin.comments.length} messages
          </span>
        )}
      </span>
    </button>
  );
}

export function MockupViewer({
  mockupId,
  imageUrl,
  initialPins,
}: {
  mockupId: string;
  imageUrl: string;
  initialPins: ViewerPin[];
}) {
  const [pins, setPins] = useState<ViewerPin[]>(initialPins);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = toNormalized(e.clientX, e.clientY, rect);
    const res = await createPin(mockupId, x, y);
    if (res.id && res.number != null) {
      const pin: ViewerPin = { id: res.id, x, y, number: res.number, status: "active", comments: [] };
      setPins((p) => [...p, pin]);
      setActivePinId(res.id);
    }
  }

  const matches = (p: ViewerPin) =>
    filter === "all" ? true : filter === "active" ? p.status === "active" : p.status === "resolved";
  const visiblePins = pins.filter(matches);
  const activePin = pins.find((p) => p.id === activePinId) ?? null;
  const counts = {
    all: pins.length,
    active: pins.filter((p) => p.status === "active").length,
    resolved: pins.filter((p) => p.status === "resolved").length,
  };

  return (
    <div className="flex h-full min-h-0">
      {/* comment rail */}
      <aside className="flex w-[344px] shrink-0 flex-col border-r bg-surface">
        {activePin ? (
          <CommentThread
            mockupId={mockupId}
            pin={activePin}
            onBack={() => setActivePinId(null)}
            onChange={(updated) =>
              setPins((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))
            }
          />
        ) : (
          <>
            <div className="border-b p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Comments</h2>
                <span className="font-mono text-xs text-faint">{counts.all}</span>
              </div>
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
                      : "Try a different filter."}
                  </p>
                </div>
              ) : (
                visiblePins.map((p) => (
                  <PinListItem key={p.id} pin={p} onSelect={() => setActivePinId(p.id)} />
                ))
              )}
            </div>
          </>
        )}
      </aside>

      {/* canvas */}
      <div className="relative flex-1 overflow-hidden bg-canvas">
        <TransformWrapper doubleClick={{ disabled: true }} minScale={0.2} centerOnInit>
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!items-start">
                <div className="relative p-10">
                  <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-border">
                    {/* react-zoom-pan-pinch sets pointer-events:none on imgs to protect
                        its pan gesture; we re-enable it (and disable native drag) so
                        clicks register and drop pins. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="mockup"
                      onClick={handleImageClick}
                      className="block w-[860px] max-w-none cursor-crosshair select-none"
                      draggable={false}
                      style={{ pointerEvents: "auto" }}
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
                  </div>
                </div>
              </TransformComponent>

              {/* zoom controls */}
              <div className="absolute bottom-5 right-5 flex items-center gap-0.5 rounded-lg border bg-surface p-1 shadow-md">
                <ZoomBtn onClick={() => zoomOut()} label="Zoom out">
                  <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </ZoomBtn>
                <button
                  onClick={() => resetTransform()}
                  className="px-2 font-mono text-xs font-semibold text-muted transition-colors hover:text-brand-ink"
                >
                  Fit
                </button>
                <ZoomBtn onClick={() => zoomIn()} label="Zoom in">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </ZoomBtn>
              </div>
            </>
          )}
        </TransformWrapper>

        {counts.all === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <span className="rounded-full bg-ink/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
              Click anywhere on the design to leave a comment
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ZoomBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
