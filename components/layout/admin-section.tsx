'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { isActivePath } from '@/lib/navigation-utils';
import { NavigationBadge } from './navigation-badge';
import { ChevronDown } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

export interface AdminSubItem {
  name: string;
  href: string;
  badge?: number;
}

export interface AdminSectionColors {
  gradient?: string;
  bg: string;
  text: string;
  light: string;
  ring: string;
}

export interface AdminSectionProps {
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  subItems: AdminSubItem[];
  pathname: string;
  onClose?: () => void;
  colors: AdminSectionColors;
  extraAction?: {
    label: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    onClick: () => void;
  };
  /** Open this section on first render even without an active child route —
   * for the groups an admin reaches for constantly (members, court ops), so
   * the dashboard doesn't hide its own main features behind an extra click. */
  defaultOpen?: boolean;
  /**
   * Kennzahl rechts in der Gruppenzeile (z. B. `248`, `68 %`).
   * Bewusst `string`, nicht `number`: die Saisonplanung zeigt einen
   * Prozentwert, die Mitglieder eine Anzahl — die Formatierung gehört zum
   * Aufrufer, nicht hierher.
   */
  badge?: string | null;
}

// Gemeinsame Section-Farben: ein ruhiger Grundton, kleine Akzente pro Rolle.
export const adminSectionColors: Record<string, AdminSectionColors> = {
  superadmin: {
    gradient: 'from-brand-accent-2 to-brand-accent-2',
    bg: 'bg-brand-accent-2/10 dark:bg-brand-accent-2/20',
    text: 'text-brand-accent-2 dark:text-brand-accent-2',
    light: 'brand-accent-2',
    ring: 'ring-brand-accent-2/40',
  },
  admin: {
    gradient: 'from-brand-primary to-brand-primary-light',
    bg: 'bg-brand-primary/10 dark:bg-brand-primary/20',
    text: 'text-brand-primary dark:text-brand-primary-light',
    light: 'brand-primary',
    ring: 'ring-brand-primary/30',
  },
  trainer: {
    gradient: 'from-success-500 to-success-700',
    bg: 'bg-success-50 dark:bg-success-900/20',
    text: 'text-success-600 dark:text-success-300',
    light: 'success',
    ring: 'ring-success-300/40',
  },
  neutral: {
    gradient: 'from-gray-500 to-gray-700',
    bg: 'bg-muted dark:bg-muted/20',
    text: 'text-foreground dark:text-foreground',
    light: 'gray',
    ring: 'ring-ring/40',
  },
};

// ── Component ────────────────────────────────────────────────────────

/**
 * Collapsible navigation section with keyboard support, badges, and
 * optional extra action button.
 *
 * Used by the admin sidebar for grouped navigation items like
 * "MITGLIEDER", "TRAINING", "FINANZEN" etc.
 */
export function AdminSection({
  label,
  icon: Icon,
  subItems,
  pathname,
  onClose,
  colors,
  extraAction,
  badge,
  defaultOpen = false,
}: AdminSectionProps) {
  const hasActiveChild = subItems.some((item) => isActivePath(pathname, item.href));
  const [isOpen, setIsOpen] = useState(hasActiveChild || defaultOpen);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation within section (roving tabindex)
  const handleSectionKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;

    const section = sectionRef.current;
    if (!section) return;

    e.preventDefault();
    const focusable = section.querySelectorAll<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const currentIndex = Array.from(focusable).indexOf(document.activeElement as HTMLElement);
    let nextIndex: number;

    switch (e.key) {
      case 'ArrowDown':
        nextIndex = currentIndex + 1 >= focusable.length ? 0 : currentIndex + 1;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex - 1 < 0 ? focusable.length - 1 : currentIndex - 1;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = focusable.length - 1;
        break;
      default:
        return;
    }

    focusable[nextIndex]?.focus();
  }, []);

  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
  return (
    <div
      ref={sectionRef}
      className="space-y-0.5"
      onKeyDown={handleSectionKeyDown}
      role="group"
      aria-label={`${label} Bereich`}
    >
      {/* Section header / toggle — small uppercase label above the group,
          still a disclosure button so collapse behaviour is unchanged. */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          // Abschnittsüberschrift ist eine Beschriftung, kein Menüpunkt: enger
          // gesperrt, kleiner, ohne eigene Hover-Fläche über die volle Breite.
          'w-full flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.15em] transition-colors duration-200',
          hasActiveChild
            ? `${colors.bg} ${colors.text}`
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
        aria-expanded={isOpen}
        aria-label={`${label} ${isOpen ? 'einklappen' : 'ausklappen'}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{label}</span>
        {badge && (
          // Mono und ohne Sperrung — die Kennzahl soll sich von der gesperrten
          // Versalschrift der Beschriftung absetzen und beim Wechsel der Zahl
          // nicht die Breite springen lassen.
          <span className="shrink-0 rounded bg-muted px-1.5 tabular-nums text-2xs font-semibold tracking-normal text-foreground/70 tabular-nums">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {/* Sub-items with smooth animation */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="ml-3.5 border-l border-border pl-1.5 space-y-px pb-0.5">
          {subItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  isActive
                    ? `${colors.bg} ${colors.text}`
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        colors.text.replace('text-', 'bg-').replace('dark:text-', 'dark:bg-')
                      )}
                    />
                  )}
                  <span>{item.name}</span>
                </div>
                {item.badge !== undefined && (
                  <NavigationBadge count={item.badge} variant="danger" />
                )}
              </Link>
            );
          })}
          {/* Extra action (e.g. Invite button) */}
          {extraAction && (
            <button
              onClick={extraAction.onClick}
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
            >
              <extraAction.icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
              <span>{extraAction.label}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions */
}
