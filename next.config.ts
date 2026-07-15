import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Mockup uploads flow through a Server Action; the default request-body
      // cap is 1MB, which rejected anything larger. Raise it above our 25MB
      // client-side validation limit (plus multipart overhead headroom).
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
