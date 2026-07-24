/**
 * Deutsche Labels für den Saison-Lebenszyklus — einzige Quelle für Status-Texte
 * in Saisonliste, Detail-Seite und Wizard.
 */

export type SeasonBadgeVariant = 'default' | 'secondary' | 'error' | 'outline';

export const SEASON_STATUS_LABELS: Record<string, { label: string; variant: SeasonBadgeVariant }> =
  {
    draft: { label: 'Entwurf', variant: 'secondary' },
    collecting_preferences: { label: 'Sammelt Präferenzen', variant: 'outline' },
    auto_planning: { label: 'Automatische Planung', variant: 'default' },
    manual_review: { label: 'Manuelle Überprüfung', variant: 'outline' },
    finalized: { label: 'Finalisiert', variant: 'default' },
    published: { label: 'Veröffentlicht', variant: 'default' },
    active: { label: 'Aktiv', variant: 'default' },
    completed: { label: 'Abgeschlossen', variant: 'secondary' },
    archived: { label: 'Archiviert', variant: 'secondary' },
  };

export function seasonStatusLabel(status: string | null | undefined): string {
  return SEASON_STATUS_LABELS[status ?? '']?.label ?? (status || 'Unbekannt');
}

export const SEASON_TYPE_LABELS: Record<string, string> = {
  summer: 'Sommer',
  winter: 'Winter',
};

export function seasonTypeLabel(type: string | null | undefined): string {
  return SEASON_TYPE_LABELS[type ?? ''] ?? (type || '—');
}

/** Workflow-Phase (0–3) für den Fortschritts-Stepper auf der Detail-Seite. */
export function seasonWorkflowPhase(status: string | null | undefined): number {
  switch (status) {
    case 'draft':
      return 0;
    case 'collecting_preferences':
      return 1;
    case 'auto_planning':
    case 'manual_review':
    case 'finalized':
      return 2;
    default:
      return 3; // published, active, completed, archived
  }
}

export const SEASON_WORKFLOW_PHASES = [
  'Vorbereiten',
  'Präferenzen sammeln',
  'Planen & Prüfen',
  'Veröffentlicht',
] as const;
