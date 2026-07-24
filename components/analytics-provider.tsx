'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';
import { getCookieConsent } from '@/components/cookie-consent-banner';
import Script from 'next/script';

function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page view changes (client-side navigation)
  useEffect(() => {
    const path = searchParams ? `${pathname}?${searchParams}` : pathname;
    trackPageView(path);
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider() {
  const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    setHasConsent(getCookieConsent() === 'accepted');
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <TrackPageView />
      </Suspense>
      {GA_MEASUREMENT_ID && hasConsent && (
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
      )}
    </>
  );
}
