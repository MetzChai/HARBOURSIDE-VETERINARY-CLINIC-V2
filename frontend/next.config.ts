import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

/**
 * Explicit allow-list for next/image remote hosts (no wildcards).
 * - res.cloudinary.com: URLs stored by the backend Cloudinary uploader.
 * - localhost / 127.0.0.1: local dev backend serving legacy /uploads/* files.
 * - Any additional non-local BACKEND_URL origin is allowed for /uploads/* only,
 *   so deployed (e.g. Vercel) environments keep working.
 */
const imageRemotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
  { protocol: "http", hostname: "localhost", pathname: "/uploads/**" },
  { protocol: "http", hostname: "127.0.0.1", pathname: "/uploads/**" },
];

try {
  const backendOrigin = new URL(backendUrl);
  const isLocal =
    backendOrigin.hostname === "localhost" || backendOrigin.hostname === "127.0.0.1";
  if (!isLocal) {
    imageRemotePatterns.push({
      protocol: backendOrigin.protocol === "https:" ? "https" : "http",
      hostname: backendOrigin.hostname,
      ...(backendOrigin.port ? { port: backendOrigin.port } : {}),
      pathname: "/uploads/**",
    });
  }
} catch {
  // Invalid BACKEND_URL falls back to the local patterns above.
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: frontendDir,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/uploads/:path*", destination: `${backendUrl}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
