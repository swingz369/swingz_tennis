'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const CONSENT_KEY = 'swingz-cookie-consent';

export type CookieConsent = 'accepted' | 'declined';

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === 'accepted' || value === 'declined' ? value : null;
}

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent | null>('accepted');
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConsent(getCookieConsent());
  }, []);

  // Das Banner liegt `fixed` über dem Seitenende und verdeckte dort alles,
  // was unten steht — zuletzt den Weiter-Button des Onboarding-Wizards.
  // Solange es sichtbar ist, bekommt der Body seine gemessene Höhe als
  // Innenabstand; ein fester Wert wäre auf Mobil zu klein, weil das Banner
  // dort umbricht.
  useEffect(() => {
    const banner = bannerRef.current;
    if (consent !== null || !banner) return;
    const apply = () => {
      document.body.style.paddingBottom = `${banner.offsetHeight}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(banner);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [consent]);

  if (consent !== null) return null;

  const decide = (value: CookieConsent) => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    // Reload so AnalyticsProvider re-reads consent and (de)activates GA.
    window.location.reload();
  };

  return (
    <div
      ref={bannerRef}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Wir nutzen Cookies für Analyse-Zwecke (Google Analytics), um SwingZ zu verbessern. Mehr
          dazu in unserer{' '}
          <a href="/datenschutz" className="underline underline-offset-2">
            Datenschutzerklärung
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide('declined')}>
            Ablehnen
          </Button>
          <Button size="sm" onClick={() => decide('accepted')}>
            Akzeptieren
          </Button>
        </div>
      </div>
    </div>
  );
}
