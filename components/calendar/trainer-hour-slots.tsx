'use client';

/**
 * Trainerstunden-Liste für die Agenda-Ansicht des Platzkalenders — Slots ohne
 * Platzbindung, deshalb keine Rasterzelle wie Sessions/Sperren, sondern eine
 * eigene Liste (siehe hooks/use-trainer-hour-slots.ts für die Begründung).
 */
import { useState } from 'react';
import { User, Clock3, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { TrainerHourSlot } from '@/hooks/use-trainer-hour-slots';

export function TrainerHourSlotsSection({
  slots,
  isMember,
  onBook,
  onWaitlist,
  bookLoading,
  waitlistLoading,
}: {
  slots: TrainerHourSlot[];
  isMember: boolean;
  onBook: (slot: TrainerHourSlot) => Promise<unknown>;
  onWaitlist: (slot: TrainerHourSlot) => Promise<unknown>;
  bookLoading: boolean;
  waitlistLoading: boolean;
}) {
  const [confirmSlot, setConfirmSlot] = useState<TrainerHourSlot | null>(null);
  const [mode, setMode] = useState<'book' | 'waitlist'>('book');

  if (slots.length === 0) return null;

  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Trainerstunden</h3>
        </div>
        <div className="space-y-2">
          {sorted.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 p-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light/10 text-primary shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{slot.trainerName}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.startTime}–{slot.endTime} Uhr
                  </p>
                </div>
              </div>
              {isMember &&
                (slot.status === 'available' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setMode('book');
                      setConfirmSlot(slot);
                    }}
                  >
                    Buchen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMode('waitlist');
                      setConfirmSlot(slot);
                    }}
                  >
                    Warteliste
                  </Button>
                ))}
              {!isMember && (
                <Badge variant={slot.status === 'available' ? 'secondary' : 'outline'}>
                  {slot.status === 'available' ? 'Frei' : 'Gebucht'}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <ConfirmDialog
        open={!!confirmSlot}
        onOpenChange={(open) => !open && setConfirmSlot(null)}
        title={mode === 'book' ? 'Trainerstunde buchen?' : 'Auf die Warteliste?'}
        description={
          confirmSlot
            ? `${confirmSlot.trainerName}, ${confirmSlot.startTime}–${confirmSlot.endTime} Uhr`
            : undefined
        }
        confirmLabel={mode === 'book' ? 'Buchen' : 'Eintragen'}
        variant="primary"
        loading={mode === 'book' ? bookLoading : waitlistLoading}
        onConfirm={async () => {
          if (!confirmSlot) return;
          await (mode === 'book' ? onBook(confirmSlot) : onWaitlist(confirmSlot));
          setConfirmSlot(null);
        }}
      >
        {mode === 'book' && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5" />
            Du erhältst eine Bestätigung.
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
