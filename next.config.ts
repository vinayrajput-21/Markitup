import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mockup bytes no longer flow through a Server Action — the browser uploads
  // them straight to Supabase Storage via a signed URL (see UploadDropzone and
  // createMockupUploadUrl). That sidesteps Vercel's 4.5MB function body cap,
  // which no `bodySizeLimit` can lift, so large mockups upload from anywhere.
  // Actions now carry only small JSON payloads, so the default 1MB cap is fine.
};

export default nextConfig;
