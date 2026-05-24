// Shared scheduling constants — single source of truth
// Adapted from TSOWAPP with SwingZ-specific extensions

export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const DAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

export const HOURS = Array.from(
  { length: 14 },
  (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`
);

export const MAX_ADULTS = 3;
export const MAX_KIDS = 6;
export const SLOT_DURATION = 90; // minutes
export const MAX_ROUNDS = 3;

export const SEASONS = [
  {
    value: 'summer',
    label: 'Sommersaison',
    start: '2026-04-01',
    end: '2026-10-31',
  },
  {
    value: 'winter',
    label: 'Wintersaison',
    start: '2026-11-01',
    end: '2027-03-31',
  },
] as const;

export const COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#EF4444',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#14B8A6',
  '#6366F1',
  '#D946EF',
  '#22D3EE',
  '#EAB308',
  '#A855F7',
];
