/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@supabase/ssr'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable static export for error pages to avoid ENOENT during build
  output: 'standalone',
};

module.exports = nextConfig;
