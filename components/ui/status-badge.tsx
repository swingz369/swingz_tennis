import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

/**
 * Centralized StatusBadge — maps semantic status strings to consistent Badge variants.
 *
 * Replaces scattered status→Badge mappings across the codebase.
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="pending" />
 * <StatusBadge status="overdue" />
 */

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'default' | 'secondary' }
> = {
  // Member status
  active: { label: 'Aktiv', variant: 'success' },
  inactive: { label: 'Inaktiv', variant: 'secondary' },
  invited: { label: 'Eingeladen', variant: 'info' },

  // Subscription / payment status
  paid: { label: 'Bezahlt', variant: 'success' },
  unpaid: { label: 'Offen', variant: 'warning' },
  overdue: { label: 'Überfällig', variant: 'error' },
  canceled: { label: 'Gekündigt', variant: 'secondary' },
  past_due: { label: 'Überfällig', variant: 'error' },
  cancelled: { label: 'Storniert', variant: 'secondary' },

  // Invoice status
  draft: { label: 'Entwurf', variant: 'secondary' },
  open: { label: 'Offen', variant: 'warning' },
  sent: { label: 'Versendet', variant: 'info' },
  reminder_sent: { label: 'Erinnerung', variant: 'warning' },
  partially_paid: { label: 'Teilbezahlt', variant: 'warning' },
  dunning: { label: 'Mahnung', variant: 'error' },
  void: { label: 'Storniert', variant: 'secondary' },
  uncollectible: { label: 'Uneinbringlich', variant: 'error' },
  refunded: { label: 'Erstattet', variant: 'info' },

  // Order status
  pending: { label: 'Ausstehend', variant: 'warning' },
  confirmed: { label: 'Bestätigt', variant: 'info' },
  shipped: { label: 'Versendet', variant: 'success' },
  delivered: { label: 'Zugestellt', variant: 'success' },

  // Approval status (Stundennachweise, Freigaben)
  approved: { label: 'Genehmigt', variant: 'success' },
  rejected: { label: 'Abgelehnt', variant: 'error' },

  // Season status
  planning: { label: 'Planung', variant: 'info' },
  published: { label: 'Veröffentlicht', variant: 'success' },
  manual_review: { label: 'Prüfung', variant: 'warning' },

  // Trainer status
  on_leave: { label: 'Urlaub', variant: 'warning' },
  terminated: { label: 'Beendet', variant: 'error' },

  // Booking waitlist — domain-specific. The dashboard's `pending` bookings
  // ARE waitlist entries (pending confirmation / free slot), so we expose
  // an explicit `waitlist` key alongside the generic `pending` mapping.
  // Consumers that need the booking-domain label use this key directly.
  waitlist: { label: 'Warteliste', variant: 'warning' },
};

interface StatusBadgeProps {
  /** Semantic status string (e.g. "active", "pending", "overdue") */
  status: string;
  /** Override the label (falls back to STATUS_CONFIG label, then raw status) */
  label?: string;
  /** Override size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional icon rendered before the label (e.g. approval checkmarks) */
  icon?: LucideIcon;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  icon: Icon,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config?.label ?? status;
  const variant = config?.variant ?? 'default';

  return (
    <Badge variant={variant} size={size} className={cn(Icon && 'gap-1', 'capitalize', className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />}
      {displayLabel}
    </Badge>
  );
}

/**
 * Get the status config for a given status string.
 * Useful for programmatic access (e.g., sorting, conditional logic).
 */
export function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status] ?? {
      label: status,
      variant: 'default' as const,
    }
  );
}
