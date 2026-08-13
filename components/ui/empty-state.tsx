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
   * Icon to display (Lucide icon). Ignored if `graphic` is provided.
   */
  icon?: LucideIcon;

  /**
   * Custom graphic element (overrides icon). Use for animated SVGs or branded illustrations.
   */
  graphic?: React.ReactNode;

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
  graphic,
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
      iconContainer: 'h-10 w-10',
      title: 'text-lg',
      description: 'text-sm',
    },
    md: {
      container: 'py-12',
      iconContainer: 'h-16 w-16',
      title: 'text-xl',
      description: 'text-base',
    },
    lg: {
      container: 'py-16',
      iconContainer: 'h-24 w-24',
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
      {graphic ? (
        <div className="mb-6">{graphic}</div>
      ) : Icon ? (
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className={cn(sizes.iconContainer, 'text-muted-foreground')} />
        </div>
      ) : null}

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

import React from 'react';
import { Users, Calendar, Inbox, Search, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

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

/* ────────────────────────────────────────────────────────────────────
   Tennis Ball Brand Graphic — Differentiation Anchor #3
   Miniatur-Version des Landing-Page-SVG, animiert mit animate-float.
   In jeder Empty-State-Komponente einsetzbar.
   ──────────────────────────────────────────────────────────────────── */

export function TennisBallGraphic({ size = 96 }: { size?: number }) {
  return (
    <div className="animate-float" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 200 200" className="drop-shadow-xl">
        <defs>
          <radialGradient id="tbg-brand" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="hsl(201 55% 70%)" />
            <stop offset="40%" stopColor="hsl(var(--brand-primary-light))" />
            <stop offset="70%" stopColor="hsl(var(--brand-primary))" />
            <stop offset="100%" stopColor="hsl(206 60% 12%)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="85" fill="url(#tbg-brand)" />
        <path
          d="M100 15 A 70 70 0 0 1 100 185"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="6"
          fill="none"
        />
        <path
          d="M100 30 A 60 60 0 0 1 100 170"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="4"
          fill="none"
        />
        <ellipse
          cx="55"
          cy="55"
          rx="35"
          ry="22"
          fill="white"
          opacity="0.13"
          transform="rotate(-50 55 55)"
        />
      </svg>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
   Branded Empty States — Tennisball-Illustration statt grauem Icon
   ──────────────────────────────────────────────────────────────────── */

export interface BrandedEmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Generic Tennisball-empty-state for any use case */
export function TennisBallEmptyState({
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className,
}: BrandedEmptyStateProps) {
  return (
    <EmptyState
      graphic={<TennisBallGraphic size={size === 'sm' ? 72 : size === 'lg' ? 128 : 96} />}
      title={title}
      description={description}
      action={action}
      secondaryAction={secondaryAction}
      size={size}
      className={className}
    />
  );
}

/** No members — Tennis club branded */
export function NoMembersBrandedEmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Mitglieder"
      description="Lade dein erstes Mitglied ein, um mit der Verwaltung zu starten."
      action={{ label: 'Mitglied einladen', onClick: onInvite }}
    />
  );
}

/** No trainers — Tennis club branded */
export function NoTrainersBrandedEmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Trainer"
      description="Füge deinen ersten Trainer hinzu und starte die Trainingsplanung."
      action={{ label: 'Trainer hinzufügen', onClick: onInvite }}
    />
  );
}

/** No courts — Tennis club branded */
export function NoCourtsBrandedEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Plätze"
      description="Erfasse die Tennisplätze deines Vereins — für Buchungen und Trainingseinheiten."
      action={{ label: 'Platz anlegen', onClick: onCreate }}
    />
  );
}

/** No tournaments — Tennis club branded */
export function NoTournamentsBrandedEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Turniere"
      description="Erstelle Vereinsturniere — deine Mitglieder können sich direkt anmelden."
      action={{ label: 'Turnier erstellen', onClick: onCreate }}
    />
  );
}

/** No seasons — Tennis club branded */
export function NoSeasonsBrandedEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Saison"
      description="Lege deine erste Saison an und starte die KI-gestützte Trainingsplanung."
      action={{ label: 'Saison anlegen', onClick: onCreate }}
    />
  );
}

/** No invoices — Tennis club branded */
export function NoInvoicesBrandedEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <TennisBallEmptyState
      title="Noch keine Rechnungen"
      description={
        onCreate
          ? 'Erstelle deine erste Rechnung, um mit der Abrechnung zu starten.'
          : 'Sobald du Rechnungen erstellt hast, erscheinen sie hier.'
      }
      {...(onCreate ? { action: { label: 'Rechnung erstellen', onClick: onCreate } } : {})}
    />
  );
}
