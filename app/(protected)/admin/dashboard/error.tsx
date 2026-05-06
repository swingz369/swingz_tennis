'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Dashboard Fehler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600 dark:text-gray-400">
            {error.message || 'Das Dashboard konnte nicht geladen werden.'}
          </p>

          {error.digest && (
            <p className="text-xs text-center text-gray-400 font-mono">Error ID: {error.digest}</p>
          )}

          <div className="space-y-2 pt-2">
            <Button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2"
              variant="default"
            >
              <RefreshCw className="h-4 w-4" />
              Erneut versuchen
            </Button>

            <Button
              variant="outline"
              onClick={() => router.push('/admin/members')}
              className="w-full flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zu Mitgliederverwaltung
            </Button>
          </div>

          <div className="pt-4 border-t text-center">
            <p className="text-sm text-gray-500">
              Problem besteht weiterhin?{' '}
              <a href="/support" className="text-brand-primary hover:underline">
                Support kontaktieren
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
