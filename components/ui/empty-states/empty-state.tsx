/**
 * Empty State Components
 * Reusable components for displaying empty states with call-to-action
 */

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Generic empty state component
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex gap-3">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * No results found state
 */
interface NoResultsProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  icon: LucideIcon;
}

export function NoResults({ searchQuery, onClearSearch, icon: Icon }: NoResultsProps) {
  return (
    <EmptyState
      icon={Icon}
      title="Keine Ergebnisse gefunden"
      description={
        searchQuery
          ? `Keine Ergebnisse für "${searchQuery}". Versuche es mit anderen Suchbegriffen.`
          : 'Keine Einträge vorhanden.'
      }
      action={
        onClearSearch && searchQuery
          ? {
              label: 'Suche zurücksetzen',
              onClick: onClearSearch,
            }
          : undefined
      }
    />
  );
}

/**
 * Error state
 */
interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  icon: LucideIcon;
}

export function ErrorState({
  title = 'Ein Fehler ist aufgetreten',
  description = 'Bitte versuche es später erneut oder kontaktiere den Support.',
  onRetry,
  icon: Icon,
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={description}
      action={
        onRetry
          ? {
              label: 'Erneut versuchen',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

/**
 * Permission denied state
 */
interface PermissionDeniedProps {
  resource: string;
  icon: LucideIcon;
}

export function PermissionDenied({ resource, icon: Icon }: PermissionDeniedProps) {
  return (
    <EmptyState
      icon={Icon}
      title="Zugriff verweigert"
      description={`Du hast keine Berechtigung, um ${resource} zu sehen. Kontaktiere einen Administrator, falls du glaubst, dass dies ein Fehler ist.`}
    />
  );
}

/**
 * Coming soon state
 */
interface ComingSoonProps {
  feature: string;
  icon: LucideIcon;
}

export function ComingSoon({ feature, icon: Icon }: ComingSoonProps) {
  return (
    <EmptyState
      icon={Icon}
      title="Demnächst verfügbar"
      description={`${feature} wird bald verfügbar sein. Bleib dran für Updates!`}
    />
  );
}

/**
 * No data available state
 */
interface NoDataProps {
  title: string;
  description: string;
  createAction?: {
    label: string;
    onClick: () => void;
  };
  icon: LucideIcon;
}

export function NoData({ title, description, createAction, icon: Icon }: NoDataProps) {
  return <EmptyState icon={Icon} title={title} description={description} action={createAction} />;
}

/**
 * Maintenance mode state
 */
export function MaintenanceMode({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <EmptyState
      icon={Icon}
      title="Wartungsmodus"
      description="Wir führen gerade Wartungsarbeiten durch. Bitte versuche es in wenigen Minuten erneut."
    />
  );
}

/**
 * Offline state
 */
export function OfflineState({ onRetry, icon: Icon }: { onRetry?: () => void; icon: LucideIcon }) {
  return (
    <EmptyState
      icon={Icon}
      title="Keine Internetverbindung"
      description="Bitte überprüfe deine Internetverbindung und versuche es erneut."
      action={
        onRetry
          ? {
              label: 'Erneut versuchen',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}
