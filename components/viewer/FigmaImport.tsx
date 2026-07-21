"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importFigmaFrame } from "@/app/app/figma-actions";
import { useToast } from "@/components/ui/toast";

export function FigmaImport({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    const id = toast.push({ title: "Importing from Figma…", variant: "loading" });
    start(async () => {
      const r = await importFigmaFrame(projectId, url);
      if (r?.error) {
        setError(r.error);
        toast.update(id, { variant: "error", title: "Import failed", description: r.error, duration: 4000 });
      } else {
        setUrl("");
        toast.update(id, { variant: "success", title: "Frame imported from Figma", duration: 2500 });
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border bg-surface p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <svg width="13" height="19" viewBox="0 0 38 57" aria-hidden>
          <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z" fill="#1abcfe" />
          <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z" fill="#0acf83" />
          <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z" fill="#ff7262" />
          <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z" fill="#f24e1e" />
          <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z" fill="#a259ff" />
        </svg>
        <span className="text-sm font-semibold text-ink">Import from Figma</span>
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a Figma prototype link…"
          className="field flex-1"
        />
        <button type="submit" disabled={pending || !url.trim()} className="btn-secondary">
          {pending ? "Importing…" : "Import"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--destructive)" }}>{error}</p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          Imports the frame as a pinnable mockup with a live Browse mode. Needs Figma connected in Settings.
        </p>
      )}
    </div>
  );
}
