import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow accessing the dev server via 127.0.0.1 in addition to localhost
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
