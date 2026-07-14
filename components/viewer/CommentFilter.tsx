"use client";

export type Filter = "all" | "active" | "resolved";

export function CommentFilter({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (f: Filter) => void;
  counts: { all: number; active: number; resolved: number };
}) {
  const items: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "All", n: counts.all },
    { k: "active", label: "Active", n: counts.active },
    { k: "resolved", label: "Resolved", n: counts.resolved },
  ];
  return (
    <div className="inline-flex w-full rounded-md border bg-canvas p-0.5">
      {items.map((it) => {
        const on = value === it.k;
        return (
          <button
            key={it.k}
            onClick={() => onChange(it.k)}
            className="flex-1 rounded px-2 py-1 text-xs font-semibold transition-colors duration-150"
            style={
              on
                ? { background: "var(--color-surface)", color: "var(--color-brand-ink)", boxShadow: "var(--shadow-xs)" }
                : { color: "var(--color-muted)" }
            }
          >
            {it.label}
            <span className="ml-1 font-mono opacity-60">{it.n}</span>
          </button>
        );
      })}
    </div>
  );
}
