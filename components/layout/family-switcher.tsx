'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, User, Baby, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import type { FamilyMember } from '@/hooks/use-family-accounts';

interface FamilySwitcherProps {
  /** Whether the current user is a parent with children */
  isParent: boolean;
  /** List of children in the family */
  childMembers: FamilyMember[];
  /** The currently active child (if parent is viewing child's account) */
  activeChild: FamilyMember | null;
  /** Whether the parent is currently viewing a child's account */
  isParentViewingChild: boolean;
  /** Switch to a child's account */
  switchToChild: (childUserId: string) => void;
  /** Switch back to own account */
  switchToOwnAccount: () => void;
  /** Role-based color scheme */
  colors: { bg: string; text: string };
}

export function FamilySwitcher({
  isParent,
  childMembers,
  activeChild,
  isParentViewingChild,
  switchToChild,
  switchToOwnAccount,
  colors,
}: FamilySwitcherProps) {
  const [open, setOpen] = useState(false);

  // Don't render if user is not a parent or has no children
  if (!isParent || childMembers.length === 0) return null;

  return (
    <div className="mx-3 mb-4 border border-border rounded-xl overflow-hidden bg-muted/50">
      {/* Toggle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isParentViewingChild ? (
            <Baby className="h-4 w-4 shrink-0 text-warning-500" />
          ) : (
            <ShieldCheck className="h-4 w-4 shrink-0 text-success-500" />
          )}
          <span className="truncate">
            {isParentViewingChild ? `Kind: ${activeChild?.fullName ?? 'Unbekannt'}` : 'Mein Konto'}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="border-t border-border overflow-hidden animate-slide-down">
          {/* Own account */}
          <button
            onClick={() => {
              switchToOwnAccount();
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
              !isParentViewingChild
                ? `${colors.bg} ${colors.text} font-medium`
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <ShieldCheck
              className={cn(
                'h-4 w-4 shrink-0',
                !isParentViewingChild ? 'text-success-500' : 'text-transparent'
              )}
            />
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Mein Konto</span>
          </button>

          {/* Children */}
          {childMembers.map((child) => {
            const isActive = isParentViewingChild && activeChild?.userId === child.userId;
            return (
              <button
                key={child.userId}
                onClick={() => {
                  switchToChild(child.userId);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 font-medium'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <ArrowLeftRight
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-warning-500' : 'text-transparent'
                  )}
                />
                <Baby className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{child.fullName}</span>
                {child.isMinor && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 font-semibold">
                    Minderjährig
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
