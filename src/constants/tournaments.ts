/** Shared tournament status labels */
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  registration: 'Anmeldung offen',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

/** Shared tournament status colors (tailwind classes) */
export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  registration: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
  active: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
  completed: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
  cancelled: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
};

/** Shared tournament status badge variants */
export const STATUS_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'success' | 'warning' | 'error'
> = {
  draft: 'secondary',
  registration: 'default',
  active: 'success',
  completed: 'secondary',
  cancelled: 'error',
};

/** Shared tournament format labels */
export const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'K.O.-System',
  double_elimination: 'Doppel-K.O.',
  round_robin: 'Jeder gegen jeden',
  swiss: 'Schweizer System',
};

/** Shared tournament category labels */
export const CATEGORY_LABELS: Record<string, string> = {
  open: 'Offen',
  men: 'Herren',
  women: 'Damen',
  mixed: 'Mixed',
  junior: 'Junioren',
  senior: 'Senioren',
};

/** Registration status labels */
export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  registered: 'Angemeldet',
  confirmed: 'Bestätigt',
  waitlisted: 'Warteliste',
  cancelled: 'Abgesagt',
  withdrew: 'Zurückgezogen',
};

/** Registration status badge variants */
export const REGISTRATION_STATUS_VARIANTS: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'secondary'
> = {
  registered: 'default',
  confirmed: 'success',
  waitlisted: 'warning',
  cancelled: 'error',
  withdrew: 'secondary',
};

/** Payment status labels */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  paid: 'Bezahlt',
  refunded: 'Erstattet',
  failed: 'Fehlgeschlagen',
};

/** Short format labels (for compact display) */
export const FORMAT_LABELS_SHORT: Record<string, string> = {
  single_elimination: 'K.O.',
  double_elimination: 'Doppel-K.O.',
  round_robin: 'Jeder gegen jeden',
  swiss: 'Schweizer System',
};
