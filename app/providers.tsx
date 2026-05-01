'use client';

import { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { AnalyticsProvider } from '@/components/analytics-provider';
import { TenantProvider } from '@/lib/tenant-context';

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

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TenantProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
      </TenantProvider>
    </ThemeProvider>
  );
}
