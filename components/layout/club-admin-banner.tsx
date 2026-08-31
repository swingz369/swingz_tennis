'use client';

/**
 * components/layout/club-admin-banner.tsx
 *
 * Hinweisleiste, solange ein Owner oder Superadmin einen Verein als Admin
 * verwaltet.
 *
 * Zwei Aufgaben in einem Element, bewusst über dem gesamten Inhalt und nicht in
 * der Navigation versteckt: Sie beantwortet ständig sichtbar die Frage „in
 * wessen Verein bin ich hier gerade?" und ist gleichzeitig der Ausgang zurück
 * zur Plattform-Konsole. Ohne sie sieht die Vereinsverwaltung eines fremden
 * Vereins exakt aus wie die eigene — die Verwechslungsgefahr ist genau das
 * Risiko, das ein Owner-Zugang mit sich bringt.
 */

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useUserRole } from '@/hooks/use-user-role';
import { useClubAdminContext } from '@/hooks/use-club-admin-context';

export function ClubAdminBanner({
  roles,
  clubName,
}: {
  roles?: string[];
  clubName?: string | null;
}) {
  const { isOwner, isSuperAdmin } = useUserRole(roles);
  const inClubContext = useClubAdminContext(isOwner || isSuperAdmin);

  if (!inClubContext) return null;

  // Der Superadmin verwaltet seine eigenen Vereine — für ihn ist das kein
  // „fremder" Verein, wohl aber ein anderer Kontext als die Tennisschule.
  const backHref = isOwner ? '/owner' : '/superadmin';
  const backLabel = isOwner ? 'Zurück zur Owner-Konsole' : 'Zurück zur Tennisschule';
  const titel = isOwner
    ? `Fremder Verein${clubName ? `: ${clubName}` : ''}`
    : (clubName ?? 'Verein');
  const rolle = isOwner ? 'Owner' : 'Superadmin';

  return (
    // Die Warn-Skala endet bei 900. `warning-950` (vorher hier für Text und
    // Button-Fläche verwendet) existiert nicht — Tailwind ließ die Klassen
    // ersatzlos weg, übrig blieb text-warning-50 auf sattem Gelb: weiß auf gelb.
    // Deshalb: gedämpfte Fläche, dunkler Text, Button als einziger Vollton.
    <div
      role="alert"
      className="sticky top-0 z-50 border-b-2 border-warning-500 bg-warning-50 text-warning-900 shadow-sm dark:border-warning-500/70 dark:bg-warning-900/30 dark:text-warning-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {/* Pulsierender Punkt: ein statisches Band übersieht man nach dem
                dritten Seitenwechsel, eine Bewegung nicht. */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-500 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning-600 dark:bg-warning-400" />
          </span>
          <ShieldAlert
            className="h-5 w-5 shrink-0 text-warning-600 dark:text-warning-400"
            aria-hidden="true"
          />
          <span className="text-sm leading-tight">
            <strong className="block font-semibold">{titel}</strong>
            <span className="text-warning-800 dark:text-warning-200/90">
              Du bist als <strong>{rolle}</strong> in der Vereinsverwaltung unterwegs. Änderungen
              wirken sich direkt auf diesen Verein aus.
            </span>
          </span>
        </span>

        <Link
          href={backHref}
          // Dark: bewusst die statischen Stufen 400/500 — die Enden der
          // Statusskala sind seit 16.08.2026 themefähig (bg-*-300 wird im
          // Dark Mode dunkel, text-*-900 hell), was diesen gefüllten Button
          // umgedreht hätte. Siehe docs/handbook/dev/theming-design-tokens.md.
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-warning-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-warning-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-600 dark:bg-warning-400 dark:text-gray-900 dark:hover:bg-warning-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
