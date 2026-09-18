import Link from 'next/link';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { requireAdminClub } from '@/lib/admin-context';
import { getSetupCounts, missingSeasonPrerequisites } from '@/lib/setup-checklist';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { NewSeasonForm } from './new-season-form';

export const dynamic = 'force-dynamic';

/**
 * Die Saisonplanung verteilt Mitglieder auf Plätze und Trainer. Fehlt eines
 * davon, entsteht ein leerer Plan — deshalb steht hier die Sperre statt des
 * Formulars. `POST /api/seasons` prüft dasselbe noch einmal serverseitig.
 */
export default async function NewSeasonPage() {
  const { supabase, clubId } = await requireAdminClub();
  const missing = missingSeasonPrerequisites(await getSetupCounts(supabase, clubId));

  if (missing.length === 0) {
    return <NewSeasonForm />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/seasons" aria-label="Zurück zu den Saisons">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title="Neue Saison erstellen"
          description="Noch nicht möglich — der Verein ist dafür nicht eingerichtet"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
            {missing.length === 1
              ? 'Ein Schritt fehlt noch'
              : `${missing.length} Schritte fehlen noch`}
          </CardTitle>
          <CardDescription>
            Die Saisonplanung verteilt Mitglieder auf Plätze und Trainer. Ohne diese Daten würde sie
            einen leeren Plan erzeugen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {missing.map((step) => (
            <Link
              key={step.key}
              href={step.href}
              className="flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:border-brand-light/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          <p className="text-xs text-muted-foreground pt-1">
            Sobald alles steht, lässt sich die Saison hier anlegen.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
