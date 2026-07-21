'use client';

import { Suspense, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { TenantProvider } from '@/lib/tenant-context';
import { ErrorBoundary } from '@/components/error-boundary';
import { NextIntlClientProvider } from 'next-intl';
import deMessages from '@/i18n/dictionaries/de.json';
import enMessages from '@/i18n/dictionaries/en.json';
import { createQueryClient } from '@/lib/query-client';

const messages: Record<string, typeof deMessages> = {
  de: deMessages,
  en: enMessages,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  const locale =
    typeof document !== 'undefined'
      ? (document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? 'de')
      : 'de';

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale] ?? deMessages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
        <TenantProvider>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </QueryClientProvider>
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          <CookieConsentBanner />
        </TenantProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
