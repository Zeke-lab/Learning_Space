import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Learning_Space",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
