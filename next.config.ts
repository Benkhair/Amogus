import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['livekit-server-sdk'],
  allowedDevOrigins: ['192.168.0.243'],
};

export default nextConfig;
