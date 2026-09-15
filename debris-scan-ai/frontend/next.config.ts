import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://debris-scan-backend.onrender.com/:path*",
      },
    ];
  },
};

export default nextConfig;
