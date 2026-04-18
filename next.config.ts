import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
    ],
  },
  experimental: {
    // Enable server actions (stable in Next.js 15)
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
