'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border p-4 space-y-3 animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">SWINGZ App installieren</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Für schnelleren Zugriff auf dem Homescreen
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowPrompt(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Button size="sm" className="w-full gap-2" onClick={handleInstall}>
        <Download className="h-4 w-4" />
        Installieren
      </Button>
    </div>
  );
}
