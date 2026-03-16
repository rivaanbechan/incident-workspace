import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/", destination: "/cases", permanent: false },
    ]
  },
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
