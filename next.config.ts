import type { NextConfig } from "next";

const allowedDevOrigins = [
  "localhost",
  "127.0.0.1",
  ...(process.env.NEXTWIKI_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  images: {
    remotePatterns: []
  }
};

export default nextConfig;
