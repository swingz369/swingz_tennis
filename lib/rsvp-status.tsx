/**
 * Shared RSVP Status Configuration
 *
 * Single source of truth for RSVP status presentation: normalization,
 * color tokens, German labels and Lucide icons.
 *
 * Used by:
 *   - components/rsvp-section.tsx (action buttons)
 *   - components/member-training-schedule.tsx (status badges)
 *
 * To add a new status, extend the `RsvpStatusKey` union and the
 * `RSVP_STATUS_CONFIG` map — all consumers pick it up automatically.
 */

import { CheckCircle2, XCircle, HelpCircle, Hourglass, type LucideIcon } from 'lucide-react';
import { Check, X, type LucideIcon as LucideIconAlt } from 'lucide-react';

export type RsvpStatusKey = 'accepted' | 'declined' | 'maybe' | 'pending' | 'unknown';

export interface RsvpStatusConfig {
  /** Internal canonical key. */
  key: RsvpStatusKey;
  /** German display label. */
  label: string;
  /** Tailwind class string for badge / button backgrounds. */
  badgeClass: string;
  /** Tailwind class string for hover state on action buttons. */
  buttonClass: string;
  /** Tailwind class string for the solid (selected) state. */
  buttonActiveClass: string;
  /** Tailwind class string for the icon color when used standalone. */
  iconClass: string;
  /** Icon for badge display. */
  icon: LucideIcon;
  /** Compact icon for inline use in buttons. */
  buttonIcon: LucideIconAlt;
  /** Sort order (lowest first). */
  order: number;
}

/**
 * Normalize any incoming status string (from DB, API, etc.) to a canonical
 * `RsvpStatusKey`. Unknown values are mapped to `unknown` (not `null`!) so
 * the consumer can still render a "Unbekannt" badge if desired.
 */
export function normalizeRsvpStatus(raw: string | null | undefined): RsvpStatusKey {
  if (!raw) return 'pending';
  const v = String(raw).toLowerCase().trim();
  if (v === 'yes' || v === 'attending' || v === 'accepted' || v === 'confirmed') {
    return 'accepted';
  }
  if (v === 'no' || v === 'declined' || v === 'rejected') {
    return 'declined';
  }
  if (v === 'maybe' || v === 'tentative') {
    return 'maybe';
  }
  if (v === 'pending' || v === 'waiting' || v === 'no_response') {
    return 'pending';
  }
  return 'unknown';
}

export const RSVP_STATUS_CONFIG: Record<RsvpStatusKey, RsvpStatusConfig> = {
  accepted: {
    key: 'accepted',
    label: 'Zusage',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
    buttonClass:
      'text-muted-foreground hover:bg-green-50 hover:text-green-700 hover:border-green-200',
    buttonActiveClass:
      'bg-green-100 text-green-700 border-green-300 ring-1 ring-green-400 hover:bg-green-100',
    iconClass: 'text-green-600',
    icon: CheckCircle2,
    buttonIcon: Check,
    order: 1,
  },
  declined: {
    key: 'declined',
    label: 'Absage',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    buttonClass: 'text-muted-foreground hover:bg-red-50 hover:text-red-700 hover:border-red-200',
    buttonActiveClass:
      'bg-red-100 text-red-700 border-red-300 ring-1 ring-red-400 hover:bg-red-100',
    iconClass: 'text-red-600',
    icon: XCircle,
    buttonIcon: X,
    order: 2,
  },
  maybe: {
    key: 'maybe',
    label: 'Vielleicht',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    buttonClass:
      'text-muted-foreground hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200',
    buttonActiveClass:
      'bg-amber-100 text-amber-700 border-amber-300 ring-1 ring-amber-400 hover:bg-amber-100',
    iconClass: 'text-amber-600',
    icon: HelpCircle,
    buttonIcon: HelpCircle,
    order: 3,
  },
  pending: {
    key: 'pending',
    label: 'Wartet auf Antwort',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    buttonClass: 'text-muted-foreground hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200',
    buttonActiveClass:
      'bg-blue-100 text-blue-700 border-blue-300 ring-1 ring-blue-400 hover:bg-blue-100',
    iconClass: 'text-blue-600',
    icon: Hourglass,
    buttonIcon: Hourglass,
    order: 4,
  },
  unknown: {
    key: 'unknown',
    label: 'Unbekannt',
    badgeClass: 'bg-muted text-foreground border-border',
    buttonClass: 'text-muted-foreground hover:bg-muted',
    buttonActiveClass: 'bg-muted text-foreground border-border ring-1 ring-border',
    iconClass: 'text-muted-foreground',
    icon: HelpCircle,
    buttonIcon: HelpCircle,
    order: 99,
  },
};

/** All selectable action button keys (excludes `unknown`). */
export const RSVP_ACTION_KEYS: RsvpStatusKey[] = ['accepted', 'declined', 'maybe'];

/** Get the config for a raw status string, normalized first. */
export function getRsvpStatusConfig(raw: string | null | undefined): RsvpStatusConfig {
  return RSVP_STATUS_CONFIG[normalizeRsvpStatus(raw)];
}

/**
 * Backwards-compatible shape for the old `getRsvpStatusBadge(rsvpStatus)`:
 * returns `{ label, color, Icon? }` for inline badge use. Returns `null`
 * when the status is empty (matches the prior contract).
 */
export function getRsvpStatusBadge(rsvpStatus: string | null | undefined): {
  label: string;
  color: string;
  icon: LucideIcon;
} | null {
  if (!rsvpStatus) return null;
  const cfg = getRsvpStatusConfig(rsvpStatus);
  if (cfg.key === 'unknown') {
    return { label: rsvpStatus, color: cfg.badgeClass, icon: cfg.icon };
  }
  return { label: cfg.label, color: cfg.badgeClass, icon: cfg.icon };
}
