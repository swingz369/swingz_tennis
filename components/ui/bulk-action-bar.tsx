'use client';

import { Button } from '@/components/ui/button';
import { CheckSquare, Loader2, UserX } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BulkActionBarProps {
  /** Fully-formed selection text, e.g. "3 Mitglieder ausgewählt". */
  selectionLabel: string;
  /** Clears the current selection. */
  onClear: () => void;
  /** Label for the primary destructive action. */
  destructiveLabel: string;
  /** Trigger for the primary destructive action (e.g. opens a confirm modal). */
  onDestructive: () => void;
  /** While true, disables all controls and shows a spinner in the destructive button. */
  destructiveLoading?: boolean;
  /** Icon for the destructive action. Defaults to `UserX`. */
  destructiveIcon?: LucideIcon;
  /** Optional "select all remaining" action, rendered between count and clear. */
  onSelectAll?: () => void;
  /** Label for the select-all action. Defaults to "Alle auswählen". */
  selectAllLabel?: string;
}

/**
 * BulkActionBar — the canonical floating pill for multi-select batch actions.
 *
 * Replaces the previously divergent copies: a `rounded-xl` card in the members
 * list and an inline `rounded-full` pill in the trainer list. One pill, mobile
 * first — it caps at the viewport width and stays centered above the bottom edge.
 */
export function BulkActionBar({
  selectionLabel,
  onClear,
  destructiveLabel,
  onDestructive,
  destructiveLoading = false,
  destructiveIcon: DestructiveIcon = UserX,
  onSelectAll,
  selectAllLabel = 'Alle auswählen',
}: BulkActionBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[min(calc(100vw-2rem),640px)] rounded-full border border-border bg-background/95 backdrop-blur shadow-lg px-3 py-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4"
      role="region"
      aria-label="Massenaktionen"
    >
      <span className="px-3 text-sm font-medium tabular-nums">{selectionLabel}</span>
      {onSelectAll && (
        <Button variant="ghost" size="sm" onClick={onSelectAll} disabled={destructiveLoading}>
          <CheckSquare className="h-4 w-4" />
          {selectAllLabel}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onClear} disabled={destructiveLoading}>
        Auswahl aufheben
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDestructive}
        disabled={destructiveLoading}
        leftIcon={
          destructiveLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DestructiveIcon className="h-4 w-4" />
          )
        }
      >
        {destructiveLabel}
      </Button>
    </div>
  );
}

BulkActionBar.displayName = 'BulkActionBar';
