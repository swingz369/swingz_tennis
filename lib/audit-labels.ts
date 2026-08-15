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
};

/** Unbekannte Aktionen bleiben lesbar statt leer — der Rohwert ist die Notlösung. */
export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function auditResourceLabel(resourceType: string): string {
  return AUDIT_RESOURCE_LABELS[resourceType] ?? resourceType;
}
