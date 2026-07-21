"use client";

import { useRef, useState } from "react";

export type CompareMockup = { id: string; name: string; url: string };

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
        <span className="shrink-0 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">{side}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field h-8 min-w-0 flex-1 text-sm"
        >
          {mockups.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto bg-canvas p-4">
        {m?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.url} alt={m.name} className="mx-auto block w-full max-w-3xl rounded-lg shadow-lg ring-1 ring-border" />
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
}: {
  mockups: CompareMockup[];
  initialLeft: string;
  initialRight: string;
}) {
  const [leftId, setLeftId] = useState(initialLeft);
  const [rightId, setRightId] = useState(initialRight);
  const [synced, setSynced] = useState(true);
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
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-center border-b bg-surface">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
          <input
            type="checkbox"
            checked={synced}
            onChange={(e) => setSynced(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          Sync scrolling
        </label>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 divide-x">
        <Panel side="Previous" value={leftId} onChange={setLeftId} mockups={mockups} scrollRef={leftRef} onScroll={() => sync("l")} />
        <Panel side="Latest" value={rightId} onChange={setRightId} mockups={mockups} scrollRef={rightRef} onScroll={() => sync("r")} />
      </div>
    </div>
  );
}
