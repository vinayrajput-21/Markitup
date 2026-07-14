"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateUpload } from "@/lib/validation";
import { uploadMockup } from "@/app/app/projects/[projectId]/actions";

export function UploadDropzone({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onFile(file: File) {
    const check = validateUpload({ size: file.size, type: file.type });
    if (!check.ok) { setError(check.error); return; }
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadMockup(projectId, fd);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mb-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="border-2 border-dashed p-6 w-full text-gray-600 hover:bg-gray-50"
      >
        {pending ? "Uploading…" : "Click to upload a PNG or JPG (max 25 MB)"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
