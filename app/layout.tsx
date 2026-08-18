import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { ServiceWorkerRegistration } from '@/components/sw-registration';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { SkipToContent } from '@/lib/accessibility';
import { AriaLiveProvider } from '@/components/aria-live-region';
import { SonnerAriaBridge } from '@/components/sonner-aria-bridge';

// ponytail: selbst gehostet statt next/font/google — Google lieferte im Vercel-Build
// eine CSS mit 404-woff2-URLs, was den Turbopack-Build killte. Latin-Subset reicht für DE.
const dmSans = localFont({
  src: './fonts/dm-sans.woff2',
  variable: '--font-sans',
  weight: '400 700', // Variable-Achse
  display: 'swap',
  // Die Textschrift der ganzen App wird vorgeladen. Ohne das kam sie erst
  // nach dem ersten Paint, und die Sidebar sprang sichtbar von system-ui auf
  // DM Sans um — genau der Schriftwechsel, der beim Vergleich mit dem Entwurf
  // auffiel. Kostet eine Preload-Anweisung für eine Datei, die ohnehin auf
  // jeder Seite gebraucht wird.
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Muss dem --background aus app/globals.css entsprechen (Clay / Nocturne),
  // sonst klafft auf Mobile eine Kante zwischen Browser-Chrome und Seite.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F3F2EE' },
    { media: '(prefers-color-scheme: dark)', color: '#0C1116' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL('https://swingz.cloud'),
  title: 'SWINGZ - Premium Tennis Club Management',
  description: 'Automatische Trainingsplanung für Tennisclubs',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      className={`${dmSans.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Theme persistence: read localStorage before React hydration to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var isDark = theme === 'dark' ||
                    (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                } catch (e) { /* localStorage blocked (private mode) — keep default theme */ }
              })();
            `,
          }}
        />
        {/* Kill stale service workers before hydration — a leftover SW from a
            local prod build can serve mismatched Turbopack chunks and break
            hard reloads before the sw-registration.tsx useEffect ever runs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (${process.env.NODE_ENV === 'development'} && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  regs.forEach(function(r) { r.unregister(); });
                });
              }
            `,
          }}
        />
        {/* Bis 18.08.2026 hingen hier vier Preconnects und ein render-blockierendes
            Stylesheet von Fontshare für „Clash Display" und „Pally". Beide
            Schriften waren in keiner einzigen Regel referenziert (`font-display`
            löst laut styles/theme.ts auf DM Sans auf) — jede Seite lud also zwei
            Schriftfamilien, die nie ein Zeichen gesetzt haben. Google-Preconnects
            ebenfalls raus: JetBrains Mono kommt über next/font und wird beim Build
            selbst gehostet, DM Sans liegt in app/fonts/.
            Die App führt bewusst **eine** Schrift. Hierarchie entsteht über Grösse,
            Gewicht und Laufweite — nicht über eine zweite Familie. */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        )}
      </head>
      <body className={`${dmSans.className} antialiased`}>
        <AriaLiveProvider>
          <SkipToContent />
          <ServiceWorkerRegistration />
          <PwaInstallPrompt />
          <Providers>{children}</Providers>
          <Toaster position="top-right" richColors />
          <SonnerAriaBridge />
        </AriaLiveProvider>
      </body>
    </html>
  );
}
