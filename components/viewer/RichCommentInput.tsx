"use client";

import { useRef, useState } from "react";

export type PendingAttachment = { path: string; type: "image" | "pdf"; name: string };

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // preserve the editor selection: don't let the button steal focus
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-[color:var(--accent)] hover:text-ink"
    >
      {children}
    </button>
  );
}

export function RichCommentInput({
  onSubmit,
  pending,
  placeholder,
  projectId,
}: {
  value?: string;
  onSubmit: (html: string, attachments: PendingAttachment[]) => void;
  pending?: boolean;
  placeholder?: string;
  projectId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);

  function exec(cmd: string, arg?: string) {
    ref.current?.focus();
    // execCommand is deprecated but universally supported; adequate for a
    // small comment formatter and avoids a heavy editor dependency.
    // jsdom (used in tests) does not implement execCommand, so guard it.
    if (typeof document.execCommand === "function") document.execCommand(cmd, false, arg);
    syncEmpty();
  }

  function syncEmpty() {
    const html = ref.current?.innerHTML ?? "";
    setEmpty(html.replace(/<br>|\s|&nbsp;/g, "").length === 0);
  }

  function submit() {
    const html = ref.current?.innerHTML ?? "";
    if (empty) return;
    onSubmit(html, []);
    if (ref.current) ref.current.innerHTML = "";
    setEmpty(true);
  }

  return (
    <div className="rounded-lg border bg-surface">
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
        <ToolBtn label="Bold" onClick={() => exec("bold")}><span className="text-sm font-bold">B</span></ToolBtn>
        <ToolBtn label="Italic" onClick={() => exec("italic")}><span className="text-sm italic">I</span></ToolBtn>
        <ToolBtn label="Underline" onClick={() => exec("underline")}><span className="text-sm underline">U</span></ToolBtn>
        <ToolBtn label="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="4" cy="6" r="1.3" fill="currentColor" /><circle cx="4" cy="12" r="1.3" fill="currentColor" /><circle cx="4" cy="18" r="1.3" fill="currentColor" /></svg>
        </ToolBtn>
        <ToolBtn label="Link" onClick={() => { const url = window.prompt("Link URL"); if (url) exec("createLink", url); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 14a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </ToolBtn>
      </div>
      <div className="relative">
        {empty && placeholder && (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-faint">{placeholder}</span>
        )}
        <div
          ref={ref}
          role="textbox"
          aria-label="Comment"
          contentEditable
          suppressContentEditableWarning
          onInput={syncEmpty}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); } }}
          data-project={projectId}
          className="min-h-[3.5rem] w-full px-3 py-2 text-sm leading-relaxed text-ink outline-none [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
      <div className="flex items-center justify-end gap-2 border-t px-2 py-1.5">
        <button type="button" disabled={pending || empty} onClick={submit} className="btn-primary btn-sm">
          {pending ? "Saving…" : "Comment"}
        </button>
      </div>
    </div>
  );
}
