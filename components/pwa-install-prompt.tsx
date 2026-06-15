'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

// TypeScript type for the beforeinstallprompt event (Chromium-only)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt — shows a dismissible banner when the app is installable.
 * Listens for the `beforeinstallprompt` event and provides a custom install UI.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as Record<string, unknown>).standalone === true);
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also listen for successful installation
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  }, []);

  if (isInstalled || !showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:bottom-6 md:max-w-sm animate-in slide-in-from-bottom-5 duration-500 motion-reduce:animate-none">
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-2xl backdrop-blur-sm">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 rounded-xl bg-brand-primary/10 p-2.5">
            <Smartphone className="h-6 w-6 text-brand-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-semibold text-sm text-foreground">SwingZ installieren</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Installiere die App auf deinem Homescreen für schnellen Zugriff und Offline-Nutzung.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleInstall}
            className="gap-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90"
          >
            <Download className="h-3.5 w-3.5" />
            Installieren
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="rounded-xl text-muted-foreground"
          >
            Später
          </Button>
        </div>
      </div>
    </div>
  );
}
