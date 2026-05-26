/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const isDev = process.env.NODE_ENV === 'development';

// script-src: unsafe-eval is only needed in development (HMR / eval-source-maps).
// unsafe-inline is required for Next.js __NEXT_DATA__ and hydration scripts.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://www.googletagmanager.com',
  'https://cdn.fontshare.com',
  'https://fonts.googleapis.com',
  'https://www.gstatic.com',
].join(' ');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@supabase/ssr'],
  turbopack: {}, // Empty turbopack config to silence Next.js 16 warning
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false, // Fail build on type errors
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co', // Supabase Storage
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // If using Unsplash
      },
    ],
    minimumCacheTTL: 31536000, // 1 year for static images
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    // Remove CSP from images block (it's handled in headers() below)
    // Only keep format/optimization settings here
  },
  compress: true,
  poweredByHeader: false,
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            // credentialless: erlaubt Cross-Origin-Ressourcen (Supabase, Stripe, Fonts) ohne Credentials,
            // sicherer Kompromiss zwischen require-corp (zu strikt) und unsafe-none (schwächt COOP ab)
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline' https://cdn.fontshare.com https://api.fontshare.com https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://cdn.fontshare.com https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.supabase.co https://api.github.com https://*.sentry.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // Service Worker header (must be served as application/javascript)
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // Manifest JSON caching
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
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
            test: /[\\/]node_modules[\\/](recharts|dnd-kit|@tanstack)[\\/]/,
            name: 'analytics',
            chunks: 'all',
            maxSize: 200 * 1024,
            minChunks: 1,
          },
          // Large libraries that benefit from separate chunking
          large: {
            test: /[\\/]node_modules[\\/](@supabase|openai|ai|zod|date-fns|uuid)[\\/]/,
            name: 'large-libs',
            chunks: 'all',
            maxSize: 300 * 1024,
            minChunks: 1,
          },
        },
      };
    }
    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
