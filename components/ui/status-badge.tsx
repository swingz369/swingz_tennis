import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  // Order status
  pending: { label: 'Ausstehend', variant: 'warning' },
  confirmed: { label: 'Bestätigt', variant: 'info' },
  shipped: { label: 'Versendet', variant: 'success' },
  delivered: { label: 'Zugestellt', variant: 'success' },

  // Season status
  planning: { label: 'Planung', variant: 'info' },
  published: { label: 'Veröffentlicht', variant: 'success' },
  manual_review: { label: 'Prüfung', variant: 'warning' },
};

interface StatusBadgeProps {
  /** Semantic status string (e.g. "active", "pending", "overdue") */
  status: string;
  /** Override the label (falls back to STATUS_CONFIG label, then raw status) */
  label?: string;
  /** Override size */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, label, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? config?.label ?? status;
  const variant = config?.variant ?? 'default';

  return (
    <Badge variant={variant} size={size} className={cn('capitalize', className)}>
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
