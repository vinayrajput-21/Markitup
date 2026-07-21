"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MockupViewer, type ViewerPin } from "./MockupViewer";
import { type Member } from "./CommentThread";
import { resyncFigma } from "@/app/app/figma-actions";

// Wraps a figma-type mockup with a Comment/Browse toggle: Comment is the normal
// pinnable viewer on the rendered frame; Browse is the live interactive embed.
export function FigmaSurface({
  embedUrl,
  figmaUrl,
  mockupId,
  projectId,
  imageUrl,
  imageName,
  initialPins,
  siblings,
  members,
  currentUserName,
}: {
  embedUrl: string;
  figmaUrl: string | null;
  mockupId: string;
  projectId: string;
  imageUrl: string;
  imageName: string;
  initialPins: ViewerPin[];
  siblings: { id: string }[];
  members: Member[];
  currentUserName: string;
}) {
  const [mode, setMode] = useState<"comment" | "browse">("comment");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function resync() {
    setError(null);
    start(async () => {
      const r = await resyncFigma(mockupId);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-surface px-3 py-2">
        <div className="inline-flex rounded-md border bg-canvas p-0.5">
          {(["comment", "browse"] as const).map((m) => {
            const on = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="rounded px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150"
                style={on ? { background: "var(--card)", color: "var(--foreground)", boxShadow: "var(--shadow-xs)" } : { color: "var(--muted-foreground)" }}
              >
                {m}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs font-medium" style={{ color: "var(--destructive)" }}>{error}</span>}
          <button onClick={resync} disabled={pending} className="btn-secondary btn-sm" title="Re-render the frame from Figma">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className={pending ? "animate-spin" : ""}>
              <path d="M20 11a8 8 0 1 0-.9 4.5M20 5v6h-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {pending ? "Syncing…" : "Re-sync"}
          </button>
          {figmaUrl && (
            <a href={figmaUrl} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              Open in Figma
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === "comment" ? (
          <MockupViewer
            mockupId={mockupId}
            projectId={projectId}
            imageUrl={imageUrl}
            imageName={imageName}
            initialPins={initialPins}
            siblings={siblings}
            members={members}
            currentUserName={currentUserName}
          />
        ) : (
          <iframe
            src={embedUrl}
            title="Figma prototype"
            className="h-full w-full border-0 bg-canvas"
            allow="fullscreen; clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
