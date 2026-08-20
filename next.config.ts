import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB — too small for a photographed registration certificate. lib/doctors/
      // caps uploads at 10MB; leave headroom above that for multipart/form-data overhead.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
