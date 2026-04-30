/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@supabase/ssr"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
