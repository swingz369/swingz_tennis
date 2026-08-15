/**
 * Deutsche Beschriftungen für Audit-Log-Aktionen und Objekttypen.
 *
 * Eine Quelle für beide Ansichten (Admin-Tab und Superadmin-Viewer) — sonst
 * driften die Übersetzungen auseinander, sobald eine neue Aktion dazukommt.
 * Die Aktionsnamen selbst schreibt `logAudit()` (lib/audit.ts).
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Generische Verben (AuditServiceImpl, Owner-Routen)
  create: 'Angelegt',
  update: 'Geändert',
  delete: 'Gelöscht',
  restore: 'Wiederhergestellt',
  cancel: 'Storniert',
  invite: 'Eingeladen',
  approve: 'Genehmigt',
  reject: 'Abgelehnt',
  login: 'Anmeldung',
  logout: 'Abmeldung',

  // Fachliche Aktionen
  user_created: 'Mitglied erstellt',
  user_deleted: 'Mitglied gelöscht',
  role_changed: 'Rolle geändert',
  settings_updated: 'Einstellungen aktualisiert',
  season_created: 'Saison erstellt',
  season_published: 'Saison veröffentlicht',
  billing_generated: 'Abrechnung erstellt',
  member_deactivated: 'Mitglied deaktiviert',
  member_status_changed: 'Mitgliedsstatus geändert',
  member_bulk_deactivated: 'Mitglieder deaktiviert (Sammelaktion)',
  members_bulk_imported: 'Mitglieder importiert (Sammelaktion)',
  session_bulk_deleted: 'Trainingseinheiten gelöscht (Sammelaktion)',
  membership_cancelled: 'Mitgliedschaft gekündigt',
  family_account_created: 'Familienkonto erstellt',
  family_account_member_added: 'Mitglied zu Familienkonto hinzugefügt',
  family_account_member_removed: 'Mitglied aus Familienkonto entfernt',
  STRIPE_QUANTITY_SYNC: 'Stripe-Abrechnung synchronisiert',
  DSGVO_DELETE: 'Konto gelöscht (DSGVO)',
  DSGVO_DELETE_INTENT: 'Kontolöschung eingeleitet (DSGVO)',
  PII_READ: 'Personenbezogene Daten eingesehen',
  READ_MEMBER: 'Mitgliedsdaten eingesehen',
  login_failed: 'Anmeldung fehlgeschlagen',
  club_switched: 'Vereinskontext gewechselt',
};

export const AUDIT_RESOURCE_LABELS: Record<string, string> = {
  member: 'Mitglied',
  membership: 'Mitgliedschaft',
  club: 'Verein',
  club_access_request: 'Zugangsanfrage',
  booking: 'Buchung',
  session: 'Trainingseinheit',
  trainer: 'Trainer',
  user: 'Benutzerkonto',
  family_group: 'Familienkonto',
  system_settings: 'Systemeinstellung',
  payment: 'Zahlung',
  invoice: 'Rechnung',
  subscription: 'Abo',
  sepa_mandate: 'SEPA-Mandat',
  trainer_note: 'Trainer-Notiz',
  league: 'Liga',
};

/** Unbekannte Aktionen bleiben lesbar statt leer — der Rohwert ist die Notlösung. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditResourceLabel(resourceType: string): string {
  return AUDIT_RESOURCE_LABELS[resourceType] ?? resourceType;
}

/**
 * Beschriftungen für die Schlüssel in `details`.
 *
 * `details` ist bewusst frei: jede Aktion legt dort ab, was sie erklärt. Für die
 * Anzeige reicht deshalb eine Teilmenge — unbekannte Schlüssel werden aus dem
 * Namen lesbar gemacht statt verworfen (siehe `humanizeKey`).
 */
const AUDIT_DETAIL_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'E-Mail',
  role: 'Rolle',
  role_before: 'Rolle vorher',
  role_after: 'Rolle nachher',
  status: 'Status',
  status_before: 'Status vorher',
  status_after: 'Status nachher',
  reason: 'Begründung',
  amount: 'Betrag',
  currency: 'Währung',
  invoice_number: 'Rechnungsnummer',
  payment_method: 'Zahlungsart',
  count: 'Anzahl',
  kind: 'Vorgang',
  url: 'URL',
  club_name_before_delete: 'Verein',
  delete_mode: 'Löschart',
  deactivated_members_count: 'Deaktivierte Mitglieder',
  stripe_refund_triggered: 'Stripe-Rückerstattung',
  resource_ref: 'Referenz',
  changed_fields: 'Geänderte Felder',
  target_email: 'Betroffene E-Mail',
  target_name: 'Betroffene Person',
  from: 'Von',
  to: 'Nach',
};

/** `deactivated_members_count` → „Deactivated members count" als letzte Rettung. */
function humanizeKey(key: string): string {
  const words = key.replace(/[_.]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'ja' : 'nein';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const parts = value.map(formatValue).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  // Verschachtelte Objekte flach als Schlüssel=Wert — besser als rohes JSON,
  // und tiefer als eine Ebene kommt in `details` praktisch nicht vor.
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      const formatted = formatValue(v);
      return formatted === null ? null : `${humanizeKey(k)}: ${formatted}`;
    })
    .filter(Boolean);
  return entries.length ? entries.join(', ') : null;
}

/** Beschriftete, anzeigefertige Zeilen aus `details`. Leere Werte fallen raus. */
export function auditDetailLines(
  details: Record<string, unknown> | null | undefined
): Array<{ label: string; value: string }> {
  if (!details) return [];
  return Object.entries(details).flatMap(([key, raw]) => {
    const value = formatValue(raw);
    if (value === null) return [];
    return [{ label: AUDIT_DETAIL_LABELS[key] ?? humanizeKey(key), value }];
  });
}

/**
 * Worauf sich der Eintrag bezieht — die Zeile, die in der Liste bisher fehlte.
 *
 * Ohne sie steht in der Oberfläche nur „Geändert · update", was für jede
 * Aktion gleich aussieht. Hier wird daraus „Verein · TC Neuland e.V.".
 * Der Name wird aus den in `details` üblichen Namensfeldern gezogen; gibt es
 * keinen, bleibt der Objekttyp allein stehen (die rohe UUID hilft niemandem).
 */
const NAME_KEYS = [
  'name',
  'club_name_before_delete',
  'target_name',
  'member_name',
  'full_name',
  'title',
  'invoice_number',
  'target_email',
  'email',
  'resource_ref',
];

export function auditSubject(log: {
  resource_type?: string | null;
  details?: Record<string, unknown> | null;
}): string {
  const type = log.resource_type ? auditResourceLabel(log.resource_type) : null;
  const details = log.details ?? {};
  const nameKey = NAME_KEYS.find((k) => typeof details[k] === 'string' && details[k]);
  const name = nameKey ? (details[nameKey] as string) : null;
  if (type && name) return `${type} · ${name}`;
  return type ?? name ?? '—';
}
