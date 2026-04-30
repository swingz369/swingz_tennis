'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';
import Script from 'next/script';

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page view changes (client-side navigation)
  useEffect(() => {
    const path = searchParams ? `${pathname}?${searchParams}` : pathname;
    trackPageView(path);
  }, [pathname, searchParams]);

  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

  // If no GA ID configured, don't inject script
  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      {/* Google Analytics 4 */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
