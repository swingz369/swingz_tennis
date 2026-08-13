/**
 * Einrichtungs-Checkliste eines Vereins.
 *
 * Der Status wird bei jedem Aufruf aus den vorhandenen Daten abgeleitet und
 * nicht als Flag gespeichert. Das hat zwei Gründe: ein gelöschter Platz macht
 * den Schritt wieder offen (kein Zustand, der mit der Realität auseinander-
 * läuft), und ein neuer Schritt kostet eine Zeile hier statt einer Migration.
 *
 * Die Reihenfolge ist die Abhängigkeitskette der App — wer sie von oben nach
 * unten abarbeitet, hat den Verein einsatzbereit und hat dabei nebenbei
 * gelernt, was worauf aufbaut. Das ersetzt einen Wizard pro Modul.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type SetupCounts = {
  courts: number;
  trainers: number;
  members: number;
  feeCategories: number;
  seasons: number;
};

export type StepDefinition = {
  key: keyof SetupCounts;
  label: string;
  /** Ein Satz, warum der Schritt existiert — im UI unter dem Label. */
  hint: string;
  href: string;
  /** Schritte, ohne die dieser hier ins Leere läuft. */
  requires?: readonly (keyof SetupCounts)[];
};

/**
 * Die Saisonplanung clustert Mitglieder auf Plätze und Trainer — fehlt eines
 * davon, erzeugt sie einen leeren Plan statt einer Fehlermeldung. Deshalb ist
 * das nicht nur ein Hinweis in der Checkliste, sondern eine Sperre: die Seite
 * `/admin/seasons/new` zeigt die Lücken statt des Formulars, und
 * `POST /api/seasons` lehnt ab (siehe `missingSeasonPrerequisites`).
 */
const SEASON_REQUIREMENTS = ['courts', 'trainers', 'members'] as const;

const STEP_DEFINITIONS: readonly StepDefinition[] = [
  {
    key: 'courts',
    label: 'Plätze anlegen',
    hint: 'Grundlage für Buchungen und Trainingszeiten.',
    href: '/admin/courts',
  },
  {
    key: 'trainers',
    label: 'Trainer einladen',
    hint: 'Trainer tragen ihre Verfügbarkeit selbst ein.',
    href: '/admin/trainers',
  },
  {
    key: 'members',
    label: 'Mitglieder einladen',
    hint: 'Auch per CSV-Import möglich.',
    href: '/admin/members',
  },
  {
    key: 'feeCategories',
    label: 'Beitragskategorien festlegen',
    hint: 'Ohne Kategorie lässt sich keine Rechnung erzeugen.',
    // Kein eigener Route-Ordner: `billing/categories/` enthält nur die
    // Client-Komponente, gerendert als Tab von `/admin/billing`.
    href: '/admin/billing?tab=categories',
  },
  {
    key: 'seasons',
    label: 'Erste Saison planen',
    hint: 'Verteilt Mitglieder automatisch auf Gruppen, Plätze und Trainer.',
    href: '/admin/seasons/new',
    requires: SEASON_REQUIREMENTS,
  },
];

export type SetupStep = StepDefinition & {
  done: boolean;
  /** Erreichbar, aber sinnlos: eine Voraussetzung fehlt noch. */
  blocked: boolean;
  /** Labels der fehlenden Voraussetzungen, für den Hinweis im UI. */
  blockedBy: string[];
};

export type SetupChecklist = {
  steps: SetupStep[];
  doneCount: number;
  totalCount: number;
  allDone: boolean;
};

export function buildSetupChecklist(counts: SetupCounts): SetupChecklist {
  const steps = STEP_DEFINITIONS.map((definition) => {
    const done = counts[definition.key] > 0;
    const blockedBy = done
      ? []
      : (definition.requires ?? [])
          .filter((required) => counts[required] <= 0)
          .map((required) => STEP_DEFINITIONS.find((s) => s.key === required)!.label);
    return { ...definition, done, blocked: blockedBy.length > 0, blockedBy };
  });

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, totalCount: steps.length, allDone: doneCount === steps.length };
}

/**
 * Was der Saisonplanung noch fehlt — die betroffenen Schritte samt Link.
 * Leeres Array heißt: darf geplant werden.
 *
 * Bewusst getrennt von `buildSetupChecklist`: dort ist ein erledigter Schritt
 * nie „blockiert", hier zählt der Ist-Zustand auch dann, wenn schon eine Saison
 * existiert und jemand danach den letzten Platz gelöscht hat.
 */
export function missingSeasonPrerequisites(counts: SetupCounts): StepDefinition[] {
  return SEASON_REQUIREMENTS.filter((key) => counts[key] <= 0).map((key) =>
    STEP_DEFINITIONS.find((s) => s.key === key)!
  );
}

/**
 * Zählt den Ist-Zustand eines Vereins. Server-only (RLS-gebundener Client).
 *
 * Mitglieder heißt hier `role = 'member'` — nicht „alles außer Trainer".
 * Sonst zählt die eigene Admin-Mitgliedschaft mit, und ein frisch angelegter
 * Verein meldet „Mitglieder einladen: erledigt", ohne dass jemand eingeladen
 * wurde.
 */
export async function getSetupCounts(
  supabase: SupabaseClient<Database>,
  clubId: string
): Promise<SetupCounts> {
  const [courts, trainers, members, feeCategories, seasons] = await Promise.all([
    countOf(
      supabase
        .from('courts')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true)
    ),
    countOf(
      supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('role', 'trainer')
        .eq('is_active', true)
    ),
    countOf(
      supabase
        .from('user_club_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('role', 'member')
        .eq('is_active', true)
    ),
    // Ohne `is_active`-Filter: die Kategorien-Seite listet inaktive Kategorien
    // mit Badge weiterhin auf. Zählte die Checkliste nur die aktiven, stünde
    // dort "noch keine Beitragskategorien", während die Seite vier zeigt.
    countOf(
      supabase
        .from('fee_configurations')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
    ),
    countOf(
      supabase.from('seasons').select('id', { count: 'exact', head: true }).eq('club_id', clubId)
    ),
  ]);

  return { courts, trainers, members, feeCategories, seasons };
}

/** Fehlende Tabelle o. ä. zählt als 0 — die Checkliste ist kein kritischer Pfad. */
async function countOf(query: PromiseLike<{ count: number | null }>): Promise<number> {
  try {
    return (await query).count ?? 0;
  } catch {
    return 0;
  }
}
