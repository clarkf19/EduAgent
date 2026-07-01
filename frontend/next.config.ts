import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // "standalone" output is required for Docker self-hosted deployments.
  // Vercel manages its own output format — setting this on Vercel causes 404s.
  // Set the DOCKER_BUILD=true env var in the Dockerfile to enable it.
  ...(process.env.DOCKER_BUILD === "true" ? { output: "standalone" } : {}),

  turbopack: {
    root: path.resolve(__dirname),
  },

  // Allow accessing the dev server via 127.0.0.1 in addition to localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
