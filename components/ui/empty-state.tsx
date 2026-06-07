/**
 * Empty State Component
 *
 * Displays a friendly empty state with icon, message, and optional action button
 */

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /**
   * Icon to display (Lucide icon)
   */
  icon?: LucideIcon;

  /**
   * Main title text
   */
  title: string;

  /**
   * Description text (optional)
   */
  description?: string;

  /**
   * Action button (optional)
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };

  /**
   * Secondary action button (optional)
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Custom className for container
   */
  className?: string;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-8',
      icon: 'h-10 w-10',
      title: 'text-lg',
      description: 'text-sm',
    },
    md: {
      container: 'py-12',
      icon: 'h-16 w-16',
      title: 'text-xl',
      description: 'text-base',
    },
    lg: {
      container: 'py-16',
      icon: 'h-24 w-24',
      title: 'text-2xl',
      description: 'text-lg',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.container,
        className
      )}
    >
      {Icon && (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className={cn(sizes.icon, 'text-muted-foreground')} />
        </div>
      )}

      <h3 className={cn('font-semibold text-foreground', sizes.title)}>{title}</h3>

      {description && (
        <p className={cn('mt-2 text-muted-foreground max-w-sm', sizes.description)}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {action && (
            <Button onClick={action.onClick} variant={action.variant || 'default'}>
              {action.label}
            </Button>
          )}

          {secondaryAction && (
            <Button onClick={secondaryAction.onClick} variant="outline">
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Empty State with specific use cases
 */

import {
  Users,
  Calendar,
  FileText,
  Inbox,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

/**
 * No members empty state
 */
export function NoMembersEmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="Noch keine Mitglieder"
      description="Lade dein erstes Mitglied ein, um loszulegen."
      action={{
        label: 'Mitglied einladen',
        onClick: onInvite,
      }}
    />
  );
}

/**
 * No sessions empty state
 */
export function NoSessionsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="Noch keine Sessions"
      description="Erstelle deine erste Trainings-Session."
      action={{
        label: 'Session erstellen',
        onClick: onCreate,
      }}
    />
  );
}

/**
 * No bookings empty state
 */
export function NoBookingsEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="Keine Buchungen"
      description="Du hast noch keine Trainings gebucht. Schau dir verfügbare Sessions an."
      action={{
        label: 'Sessions ansehen',
        onClick: onBrowse,
      }}
    />
  );
}

/**
 * No invoices empty state
 */
export function NoInvoicesEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="Keine Rechnungen"
      description={
        onCreate
          ? 'Es gibt noch keine Rechnungen. Erstelle deine erste Rechnung.'
          : 'Du hast aktuell keine offenen Rechnungen.'
      }
      {...(onCreate ? { action: { label: 'Rechnung erstellen', onClick: onCreate } } : {})}
    />
  );
}

/**
 * No search results empty state
 */
export function NoSearchResultsEmptyState({ searchTerm }: { searchTerm?: string }) {
  return (
    <EmptyState
      icon={Search}
      title="Keine Ergebnisse gefunden"
      description={
        searchTerm
          ? `Keine Ergebnisse für "${searchTerm}". Versuche einen anderen Suchbegriff.`
          : 'Versuche einen anderen Suchbegriff.'
      }
      size="sm"
    />
  );
}

/**
 * Generic empty inbox state
 */
export function EmptyInboxState() {
  return (
    <EmptyState
      icon={Inbox}
      title="Alles erledigt!"
      description="Du hast keine neuen Benachrichtigungen."
      size="sm"
    />
  );
}

/**
 * Error state
 */
export function ErrorState({
  title = 'Ein Fehler ist aufgetreten',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description || 'Bitte versuche es später erneut.'}
      {...(onRetry ? { action: { label: 'Erneut versuchen', onClick: onRetry } } : {})}
    />
  );
}

/**
 * Success state
 */
export function SuccessState({ title, description }: { title: string; description?: string }) {
  return <EmptyState icon={CheckCircle2} title={title} description={description} size="sm" />;
}

/**
 * Forbidden/No Access state
 */
export function ForbiddenState() {
  return (
    <EmptyState
      icon={XCircle}
      title="Keine Berechtigung"
      description="Du hast keine Berechtigung, um auf diese Ressource zuzugreifen."
    />
  );
}
