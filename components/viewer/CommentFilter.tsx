"use client";
export type Filter = "all" | "active" | "resolved";
export function CommentFilter({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="mb-3 flex gap-2 text-sm">
      {(["all", "active", "resolved"] as Filter[]).map((f) => (
        <button key={f} onClick={() => onChange(f)}
          className={`capitalize ${value === f ? "font-semibold underline" : "text-gray-500"}`}>{f}</button>
      ))}
    </div>
  );
}
