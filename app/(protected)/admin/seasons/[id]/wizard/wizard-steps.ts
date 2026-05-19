export const WIZARD_STEPS = [
  { label: 'Einstellungen', href: 'preferences' },
  { label: 'Gruppen', href: 'groups' },
  { label: 'Plan', href: 'plan' },
  { label: 'Billing', href: 'billing' },
  { label: 'Veröffentlichen', href: 'publish' },
] as const;

const STATUS_TO_STEP: Record<string, number> = {
  draft: 0,
  collecting_preferences: 1,
  auto_planning: 2,
  manual_review: 2,
  invoices_generated: 3,
  published: 4,
  active: 4,
  completed: 4,
  archived: 4,
};

export function getActiveStep(status: string): number {
  return STATUS_TO_STEP[status] ?? 0;
}
