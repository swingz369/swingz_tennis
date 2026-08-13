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

export type SetupCounts = {
  courts: number;
  trainers: number;
  members: number;
  feeCategories: number;
  seasons: number;
};

type StepDefinition = {
  key: keyof SetupCounts;
  label: string;
  /** Ein Satz, warum der Schritt existiert — im UI unter dem Label. */
  hint: string;
  href: string;
  /** Schritte, ohne die dieser hier ins Leere läuft. */
  requires?: readonly (keyof SetupCounts)[];
};

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
    // Die Saisonplanung clustert Mitglieder auf Plätze und Trainer — fehlt
    // eines davon, erzeugt sie einen leeren Plan statt einer Fehlermeldung.
    requires: ['courts', 'trainers', 'members'],
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
