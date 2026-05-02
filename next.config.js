const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: true, // Temporarily disable PWA for debugging
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@supabase/ssr'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Code splitting optimizations
  webpack: (config, { dev, isServer }) => {
    // Exclude Supabase Edge Functions from Next.js build
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push(function ({ request }) {
        return request.includes('supabase/functions');
      });
    }

    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            maxSize: 244 * 1024,
            minChunks: 1,
          },
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide|sonner|clsx|tailwind-merge|class-variance-authority)[\\/]/,
            name: 'ui-lib',
            chunks: 'all',
            maxSize: 150 * 1024,
            minChunks: 1,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'react-core',
            chunks: 'all',
            maxSize: 200 * 1024,
            minChunks: 1,
          },
          analytics: {
            test: /[\\/]node_modules[\\/](recharts|dnd-kit)[\\/]/,
            name: 'analytics',
            chunks: 'all',
            maxSize: 200 * 1024,
            minChunks: 1,
          },
        },
      };
    }
    return config;
  },
};

module.exports = withPWA(nextConfig);
