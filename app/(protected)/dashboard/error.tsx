'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('Dashboard page error:', error);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <CardTitle className="text-2xl">Dashboard-Fehler</CardTitle>
              <CardDescription>
                Ein Fehler ist beim Laden des Dashboards aufgetreten
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-mono text-muted-foreground">
              {error.message || 'Unbekannter Fehler'}
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mt-2">Fehler-ID: {error.digest}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={reset} variant="default">
              Erneut versuchen
            </Button>
            <Button asChild variant="outline">
              <Link href="/superadmin/dashboard">Zum Superadmin Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Zu meinem Profil</Link>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong>Hinweis:</strong> Wenn das Problem weiterhin besteht, verwenden Sie bitte das{' '}
              <Link href="/superadmin/dashboard" className="underline">
                Superadmin Dashboard
              </Link>{' '}
              als Alternative.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
