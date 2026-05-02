import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { cookies } from 'next/headers';
import { QueryProvider } from './query-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'SWINGZ - Tennisclub Management',
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
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`}>
      <head>
        {/* Resource hints for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Supabase CDN preconnect if using Supabase Auth directly from client */}
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        )}
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <Providers>{children}</Providers>
          <Toaster position="top-right" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
