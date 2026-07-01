'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { cn } from '@/lib/utils';
import type { VoteChoice, DecisionVote } from '@/lib/types/decisions';

type VoteState = DecisionVote | null;

interface DecisionVoteButtonProps {
  decisionId: string;
  /** Current vote cast by this user (null = not yet voted). */
  currentVote?: VoteState;
  /** Disable voting while decision is finalized/cancelled. */
  disabled?: boolean;
  /** Optional callback fired after a successful vote cast. */
  onVote?: (choice: VoteChoice, vote: DecisionVote) => void;
  /** Render variant: compact (default) or full-width stack. */
  variant?: 'compact' | 'stack';
}

/**
 * DecisionVoteButton — drei Buttons (Für / Dagegen / Enthaltung).
 *
 * POST /api/decisions/{id}/votes mit CastVoteSchema. Server-side UPSERT
 * erlaubt idempotente Revoting, daher kann die Auswahl jederzeit geändert werden.
 *
 * @example
 * <DecisionVoteButton
 *   decisionId={decision.id}
 *   currentVote={myVote}
 *   disabled={decision.status !== 'in_progress'}
 * />
 */
export function DecisionVoteButton({
  decisionId,
  currentVote = null,
  disabled = false,
  onVote,
  variant = 'compact',
}: DecisionVoteButtonProps) {
  const [vote, setVote] = useState<VoteState>(currentVote);
  const [pending, startTransition] = useTransition();

  const castVote = (choice: VoteChoice) => {
    if (disabled || pending) return;
    startTransition(async () => {
      // Optimistic update
      const optimistic: DecisionVote = {
        id: vote?.id ?? 'optimistic',
        decision_id: decisionId,
        voter_id: vote?.voter_id ?? 'optimistic',
        choice,
        voted_at: new Date().toISOString(),
      };
      setVote(optimistic);

      const res = await apiFetch(`/api/decisions/${decisionId}/votes`, {
        method: 'POST',
        body: JSON.stringify({ choice }),
      });
      if (!res.ok) {
        // Revert optimistic update
        setVote(currentVote);
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Stimme konnte nicht gespeichert werden');
        return;
      }
      const saved = (await res.json()) as DecisionVote;
      setVote(saved);
      onVote?.(choice, saved);
      const label =
        choice === 'for' ? 'Zugestimmt' : choice === 'against' ? 'Abgelehnt' : 'Enthaltung';
      toast.success(label);
    });
  };

  const isSelected = (choice: VoteChoice) => vote?.choice === choice;
  const containerClass =
    variant === 'stack'
      ? 'flex flex-col gap-2 w-full'
      : 'inline-flex items-center gap-2 rounded-lg border bg-muted/40 p-1';

  return (
    <div className={containerClass} role="group" aria-label="Abstimmung">
      <Button
        type="button"
        size={variant === 'stack' ? 'default' : 'sm'}
        variant={isSelected('for') ? 'default' : 'ghost'}
        disabled={disabled || pending}
        onClick={() => castVote('for')}
        className={cn('gap-1.5', isSelected('for') && 'bg-success-600 hover:bg-success-700 text-white')}
        aria-pressed={isSelected('for')}
      >
        {pending && vote?.choice === 'for' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Für
      </Button>
      <Button
        type="button"
        size={variant === 'stack' ? 'default' : 'sm'}
        variant={isSelected('against') ? 'default' : 'ghost'}
        disabled={disabled || pending}
        onClick={() => castVote('against')}
        className={cn('gap-1.5', isSelected('against') && 'bg-error-600 hover:bg-error-700 text-white')}
        aria-pressed={isSelected('against')}
      >
        {pending && vote?.choice === 'against' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        Dagegen
      </Button>
      <Button
        type="button"
        size={variant === 'stack' ? 'default' : 'sm'}
        variant={isSelected('abstain') ? 'default' : 'ghost'}
        disabled={disabled || pending}
        onClick={() => castVote('abstain')}
        className={cn(
          'gap-1.5',
          isSelected('abstain') && 'bg-gray-600 hover:bg-gray-700 text-white'
        )}
        aria-pressed={isSelected('abstain')}
      >
        {pending && vote?.choice === 'abstain' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MinusCircle className="h-4 w-4" />
        )}
        Enthaltung
      </Button>
    </div>
  );
}
