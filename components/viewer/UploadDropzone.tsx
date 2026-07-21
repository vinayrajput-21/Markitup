"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload } from "@/lib/validation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  createMockupUploadUrl,
  finalizeMockup,
} from "@/app/app/projects/[projectId]/actions";

export function UploadDropzone({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const toast = useToast();

  function fail(message: string, iv?: ReturnType<typeof setInterval>) {
    if (iv) clearInterval(iv);
    setProgress(0);
    setError(message);
    toast.error(message);
  }

  function onFile(file: File) {
    const check = validateUpload({ size: file.size, type: file.type });
    if (!check.ok) {
      setError(check.error);
      toast.error(check.error);
      return;
    }
    setError(null);
    setProgress(6);
    start(async () => {
      // Smooth simulated progress that eases toward ~92% and snaps to 100% on done.
      const iv = setInterval(() => setProgress((p) => (p < 92 ? p + (92 - p) * 0.14 : p)), 160);
      try {
        // 1. Ask the server for a signed upload URL (tiny request).
        const target = await createMockupUploadUrl(projectId, file.type);
        if ("error" in target && target.error) return fail(target.error, iv);

        // 2. Send the bytes straight to Supabase Storage, bypassing the Server
        // Action body limit so files up to 25 MB upload from anywhere.
        const supabase = createBrowserSupabase();
        const { error: upErr } = await supabase.storage
          .from("mockups")
          .uploadToSignedUrl(target.path!, target.token!, file, { contentType: file.type });
        if (upErr) return fail(upErr.message, iv);

        // 3. Record the mockup row (reference only, no bytes).
        const res = await finalizeMockup(projectId, target.path!, file.name);
        clearInterval(iv);
        if (res.error) return fail(res.error);
        setProgress(100);
        toast.success("Mockup uploaded", { description: file.name });
        setTimeout(() => setProgress(0), 500);
        router.refresh();
      } catch {
        fail("Upload failed. Please try again.", iv);
      }
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className="group flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 disabled:opacity-70"
        style={{
          borderColor: dragging ? "var(--color-brand-ring)" : "var(--color-border-strong)",
          background: dragging ? "var(--color-brand-soft)" : "var(--color-surface)",
        }}
      >
        <span
          className="grid h-12 w-12 place-items-center rounded-full transition-colors"
          style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}
        >
          {pending ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 16V5m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 15v2.5A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">
            {pending ? "Uploading…" : "Drop a mockup, or click to browse"}
          </span>
          {pending ? (
            <span className="mx-auto mt-2 block h-1.5 w-40 overflow-hidden rounded-full" style={{ background: "var(--color-brand-soft)" }}>
              <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${progress}%`, background: "var(--color-brand)" }} />
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-faint">PNG or JPG, up to 25 MB</span>
          )}
        </span>
      </button>
      {error && (
        <p className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
