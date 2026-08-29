import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        // Self-hosted Supabase storage (Hetzner migration 2026-06)
        protocol: 'https',
        hostname: 'supabase.orangecat.ch',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
};

export default nextConfig;
