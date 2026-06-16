'use client';

import { Suspense, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { TenantProvider } from '@/lib/tenant-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/i18n/dictionaries/de.json';
import enMessages from '@/i18n/dictionaries/en.json';

const messages: Record<string, typeof deMessages> = {
  de: deMessages,
  en: enMessages,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
          },
        },
      })
  );

  const locale =
    typeof document !== 'undefined'
      ? (document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? 'de')
      : 'de';

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale] ?? deMessages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TenantProvider>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </QueryClientProvider>
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
        </TenantProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
