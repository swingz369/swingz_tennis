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
}

// Pre-defined colour themes (mirrors roleColors in sidebar)
export const adminSectionColors: Record<string, AdminSectionColors> = {
  superadmin: {
    gradient: 'from-purple-500 to-purple-700',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    light: 'purple',
    ring: 'ring-purple-300/40',
  },
  admin: {
    gradient: 'from-brand-light to-brand-primary',
    bg: 'bg-brand-light/10 dark:bg-brand-light/15',
    text: 'text-brand-light dark:text-green-300',
    light: 'brand-light',
    ring: 'ring-brand-light/30',
  },
  trainer: {
    gradient: 'from-emerald-500 to-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-300',
    light: 'emerald',
    ring: 'ring-emerald-300/40',
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
}: AdminSectionProps) {
  const hasActiveChild = subItems.some((item) => isActivePath(pathname, item.href));
  const [isOpen, setIsOpen] = useState(hasActiveChild);
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
      {/* Section header / toggle — unified with Dashboard + secondary nav items */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          hasActiveChild
            ? `${colors.bg} ${colors.text} shadow-sm`
            : 'text-muted-foreground dark:text-foreground hover:bg-muted dark:hover:bg-background/[0.04] hover:text-foreground dark:hover:text-white'
        )}
        aria-expanded={isOpen}
        aria-label={`${label} ${isOpen ? 'einklappen' : 'ausklappen'}`}
      >
        <Icon
          className={cn(
            'h-5 w-5 shrink-0 transition-transform duration-200',
            hasActiveChild && 'scale-110'
          )}
          aria-hidden="true"
        />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 transition-all duration-300 opacity-50',
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
        <div
          className="ml-2 pl-2 border-l border-border/50 dark:border-white/[0.06] space-y-0.5 pb-0.5"
          role="list"
        >
          {subItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => onClose?.()}
                role="listitem"
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? `${colors.bg} ${colors.text} shadow-sm`
                    : 'text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-background/[0.04] hover:text-foreground dark:hover:text-foreground'
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
              className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground dark:text-muted-foreground hover:bg-muted dark:hover:bg-background/[0.04] hover:text-foreground dark:hover:text-foreground transition-all duration-150"
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
