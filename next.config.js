/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@supabase/ssr'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'], // Add custom domain logos if hosted externally
  },
  compress: true,
  poweredByHeader: false,
  // Code splitting optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 244 * 1024, // 244 KB
          },
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide|sonner|clsx|tailwind-merge)[\\/]/,
            name: 'ui-lib',
            chunks: 'all',
            maxSize: 150 * 1024, // 150 KB
          },
        },
      };
    }
    return config;
  },
};

module.exports = nextConfig;
