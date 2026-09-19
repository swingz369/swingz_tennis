import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

/** Vom Widget-Anbieter freigegebener Host — muss mit `frame-src` in next.config.js übereinstimmen. */
const WIDGET_URL = 'https://services.tennis.de/extern/tennisdeteamsearch.zul';
const LINK_COLOR = '00599F';

/**
 * Offizielles tennis.de-Mannschaftswidget (Mannschaften, Spielplan, Tabellen) im iFrame.
 * Reine Anzeige von tennis.de — wir übernehmen keine Daten. Verband + Vereinsnummer kommen
 * aus `clubs` (Einstellungen → Verein). `settingsHref` verlinkt dorthin, wenn sie fehlen.
 */
export async function TennisdeWidget({
  clubId,
  settingsHref,
}: {
  clubId: string | null;
  settingsHref?: string;
}) {
  let verband: string | null = null;
  let vereinNr: string | null = null;
  if (clubId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('clubs')
      .select('tennisde_verband, tennisde_verein_nr')
      .eq('id', clubId)
      .maybeSingle();
    verband = data?.tennisde_verband ?? null;
    vereinNr = data?.tennisde_verein_nr ?? null;
  }

  if (!verband || !vereinNr) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Für diesen Verein sind Verbandskürzel und Vereinsnummer von tennis.de noch nicht
          hinterlegt.
          {settingsHref && (
            <>
              {' '}
              <Link href={settingsHref} className="underline underline-offset-2">
                Jetzt in den Einstellungen eintragen
              </Link>
              .
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const src = `${WIDGET_URL}?${new URLSearchParams({ verband, verein: vereinNr, linkfarbe: LINK_COLOR })}`;
  return (
    <div className="space-y-2">
      {/* Fremde Seite mit hellem Hintergrund — deshalb weißer Rahmen auch im Dark Mode. */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <iframe
          title="Mannschaften und Spielplan (tennis.de)"
          src={src}
          className="h-[800px] w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="text-xs text-muted-foreground">Quelle: tennis.de, Anzeige ohne Gewähr.</p>
    </div>
  );
}
