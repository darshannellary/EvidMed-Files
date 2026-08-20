import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for a photographed registration certificate. lib/doctors/
      // caps uploads at 4MB; this only matters for local dev / non-Vercel hosting — on Vercel,
      // serverless functions (Server Actions included) enforce a hard, infrastructure-level
      // 4.5MB request body limit that this config option cannot raise or override.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
