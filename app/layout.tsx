import type { Metadata, Viewport } from 'next';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { cookies } from 'next/headers';
import { QueryProvider } from './query-provider';
import { ServiceWorkerRegistration } from '@/components/sw-registration';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false, // Avoid preload warnings for fonts not used immediately
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1B4332' },
    { media: '(prefers-color-scheme: dark)', color: '#0f2d22' },
  ],
};

export const metadata: Metadata = {
  title: 'SWINGZ - Premium Tennis Club Management',
  description: 'KI-gestützte Trainingplanung für Tennisclubs',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'de';
  return (
    <html
      lang={locale}
      className={`${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        )}
      </head>
      <body className={`${dmSans.className} antialiased`}>
        <ServiceWorkerRegistration />
        <QueryProvider>
          <Providers>{children}</Providers>
          <Toaster position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
