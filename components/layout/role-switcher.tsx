'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ShieldCheck, User, ArrowLeftRight } from 'lucide-react';

interface RoleSwitcherProps {
  /** Whether the member surface is currently active. */
  isMemberMode: boolean;
  /** Switch to the member ("Spielen") surface. */
  switchToMember: () => void;
  /** Switch back to the admin ("Verwalten") surface. */
  switchToAdmin: () => void;
}

/**
 * Schalter zwischen „Verwalten“ (Admin-Konsole) und „Spielen“ (Mitglieder-
 * Oberfläche) für Menschen mit Doppelrolle. Bewusst kompakt wie der
 * Family-Switcher — gleiche Optik, gleiche Position über dem Vereinsblock.
 */
export function RoleSwitcher({ isMemberMode, switchToMember, switchToAdmin }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-3 mb-3 border border-border rounded-xl overflow-hidden bg-muted/50">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isMemberMode ? (
            <User className="h-4 w-4 shrink-0 text-info-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-accent" />
          )}
          <span className="truncate">
            {isMemberMode ? 'Spielen (Mitglied)' : 'Verwalten (Admin)'}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border overflow-hidden animate-slide-down">
          <button
            onClick={() => {
              switchToAdmin();
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
              !isMemberMode
                ? 'bg-brand-light/10 text-brand-light dark:text-success-300 font-medium'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <ShieldCheck
              className={cn(
                'h-4 w-4 shrink-0',
                !isMemberMode ? 'text-brand-accent' : 'text-transparent'
              )}
            />
            <span className="truncate">Verwalten (Admin)</span>
          </button>

          <button
            onClick={() => {
              switchToMember();
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
              isMemberMode
                ? 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 font-medium'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <ArrowLeftRight
              className={cn(
                'h-4 w-4 shrink-0',
                isMemberMode ? 'text-info-500' : 'text-transparent'
              )}
            />
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Spielen (Mitglied)</span>
          </button>
        </div>
      )}
    </div>
  );
}
