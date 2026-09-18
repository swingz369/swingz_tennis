'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <Search className="h-16 w-16 text-muted-foreground" />
          </div>
        </div>

        <h1 className="mb-2 text-5xl font-bold text-foreground">404</h1>
        <h2 className="mb-4 text-2xl font-semibold text-foreground">Seite nicht gefunden</h2>

        <p className="mb-8 text-muted-foreground">
          Die angeforderte Seite existiert nicht oder wurde verschoben. Bitte überprüfe die URL oder
          kehre zur Startseite zurück.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="h-5 w-5" />
              Zur Startseite
            </Link>
          </Button>

          <Button size="lg" variant="outline" className="gap-2" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
            Zurück
          </Button>
        </div>
      </div>
    </div>
  );
}
