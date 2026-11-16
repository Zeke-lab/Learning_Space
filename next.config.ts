import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/export-pdf": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/mermaid/dist/mermaid.min.js"],
  },
};

export default nextConfig;
