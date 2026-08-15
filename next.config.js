/** @type {import('next').NextConfig} */

const { withSentryConfig } = require('@sentry/nextjs');

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
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      '@supabase/supabase-js',
    ],
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
              "connect-src 'self' https://*.supabase.co https://*.swingz.cloud https://api.stripe.com wss://*.supabase.co wss://*.swingz.cloud https://api.github.com https://*.sentry.io",
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
      // Eingeloggte Bereiche nie zwischenspeichern.
      //
      // Next.js liefert unter derselben URL zwei Varianten aus — HTML für den
      // Seitenaufruf, die RSC-Nutzlast (`text/x-component`) für die clientseitige
      // Navigation — und trennt sie nur über `Vary: rsc, next-router-state-tree, …`.
      // Firefox unterscheidet die Varianten darüber nicht zuverlässig und gibt beim
      // Neuladen mit F5 die zwischengespeicherte RSC-Nutzlast als Dokument aus; die
      // Seite bleibt leer, bis man über eine andere Route neu einsteigt. Chrome
      // trifft die Unterscheidung korrekt, weshalb der Fehler dort nicht auftrat.
      //
      // `no-store` verbietet das Ablegen und ist für diese Seiten ohnehin richtig:
      // sie enthalten personenbezogene Daten. Öffentliche Seiten (Landing, Impressum,
      // Datenschutz) bleiben absichtlich außen vor und behalten ihr Caching.
      {
        source:
          '/:path(dashboard|admin|superadmin|owner|trainer|member|messages|bookings|scheduler|billing|search|documents)',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' }],
      },
      {
        source:
          '/:path(dashboard|admin|superadmin|owner|trainer|member|messages|bookings|scheduler|billing|search|documents)/:rest*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' }],
      },
    ];
  },
  // Redirects
  async redirects() {
    return [
      // Duplicate/contradictory privacy page removed — /datenschutz is canonical
      // (linked from landing/terms/support/impressum; /privacy was only linked
      // from login and falsely claimed data never leaves the EU).
      {
        source: '/privacy',
        destination: '/datenschutz',
        permanent: true,
      },
      // Navigation consolidation: old routes → new merged pages
      // Note: /admin/season-plan/:seasonId is NOT redirected — it's the
      // grid/schedule view (SeasonPlanGridClient), linked from the "Plan"
      // tab's "Stundenplan (Grid-Ansicht)" button once a season is
      // published. It used to be caught by this same-prefix redirect,
      // which made that button a dead link.
      {
        source: '/admin/season-plan',
        destination: '/admin/seasons',
        permanent: true,
      },
      {
        source: '/admin/schedules',
        destination: '/admin/seasons',
        permanent: true,
      },
      {
        source: '/admin/courts/manage',
        destination: '/admin/courts',
        permanent: true,
      },
      {
        source: '/admin/billing/categories',
        destination: '/admin/billing',
        permanent: true,
      },
      {
        source: '/admin/reports',
        destination: '/admin/analytics',
        permanent: true,
      },
      {
        source: '/admin/branding',
        destination: '/admin/settings',
        permanent: true,
      },
      // Platztypen werden in /admin/courts verwaltet (courts-manage-client ruft
      // /api/court-types), nicht in den Vereinseinstellungen — der frühere
      // Redirect auf /admin/settings führte auf eine Seite ohne Platztypen.
      // permanent:false (307), weil das alte 308 auf /admin/settings in Browsern
      // gecacht ist — ein erneutes 308 würde dieselbe Falle nochmal stellen.
      {
        source: '/admin/court-types',
        destination: '/admin/courts',
        permanent: false,
      },
      // Abwesenheiten wurde als Tab in Stundennachweise integriert (gehört fachlich
      // zusammen: beides Trainer-Zeiterfassung). permanent:false (307), nicht 308 —
      // ein 308 hier hat zuvor schon einmal eine Seite dauerhaft im Browser-Cache
      // "verschluckt", siehe /admin/hours-logs-Vorfall.
      {
        source: '/admin/absences',
        destination: '/admin/hours-logs',
        permanent: false,
      },
      // Versammlungen + Board-Beschlüsse wurden als Tabs in Dokumente integriert
      // (Vereinsführungs-Themen gehören fachlich zusammen). permanent:false (307).
      {
        source: '/admin/meetings',
        destination: '/admin/documents',
        permanent: false,
      },
      {
        source: '/admin/decisions',
        destination: '/admin/documents',
        permanent: false,
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

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
