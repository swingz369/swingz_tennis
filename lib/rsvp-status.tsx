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
    badgeClass: 'bg-success-100 text-success-700 border-success-200',
    buttonClass:
      'text-muted-foreground hover:bg-success-50 hover:text-success-700 hover:border-success-200',
    buttonActiveClass:
      'bg-success-100 text-success-700 border-success-300 ring-1 ring-success-400 hover:bg-success-100',
    iconClass: 'text-success-600',
    icon: CheckCircle2,
    buttonIcon: Check,
    order: 1,
  },
  declined: {
    key: 'declined',
    label: 'Absage',
    badgeClass: 'bg-error-100 text-error-700 border-error-200',
    buttonClass:
      'text-muted-foreground hover:bg-error-50 hover:text-error-700 hover:border-error-200',
    buttonActiveClass:
      'bg-error-100 text-error-700 border-error-300 ring-1 ring-error-400 hover:bg-error-100',
    iconClass: 'text-error-600',
    icon: XCircle,
    buttonIcon: X,
    order: 2,
  },
  maybe: {
    key: 'maybe',
    label: 'Vielleicht',
    badgeClass: 'bg-warning-100 text-warning-700 border-warning-200',
    buttonClass:
      'text-muted-foreground hover:bg-warning-50 hover:text-warning-700 hover:border-warning-200',
    buttonActiveClass:
      'bg-warning-100 text-warning-700 border-warning-300 ring-1 ring-warning-400 hover:bg-warning-100',
    iconClass: 'text-warning-600',
    icon: HelpCircle,
    buttonIcon: HelpCircle,
    order: 3,
  },
  pending: {
    key: 'pending',
    label: 'Wartet auf Antwort',
    badgeClass: 'bg-info-100 text-info-700 border-info-200',
    buttonClass: 'text-muted-foreground hover:bg-info-50 hover:text-info-700 hover:border-info-200',
    buttonActiveClass:
      'bg-info-100 text-info-700 border-info-300 ring-1 ring-info-400 hover:bg-info-100',
    iconClass: 'text-info-600',
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
