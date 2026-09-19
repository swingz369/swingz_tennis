'use client';

import { format } from 'date-fns';
import { de } from '@/lib/locale';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Lock, PartyPopper, Wrench, CloudRain } from 'lucide-react';
import type { Court } from '@/hooks/use-courts';

export type BlockType = 'event' | 'maintenance' | 'weather';

interface WeatherData {
  description: string;
  temperature: number;
}

interface BlockCourtDialogProps {
  open: boolean;
  onClose: () => void;
  courtId: string;
  courts: Court[];
  date: Date;
  timeSlot: string;
  blockType: BlockType;
  onBlockTypeChange: (type: BlockType) => void;
  weatherData: WeatherData | null;
  duration: number;
  onDurationChange: (hours: number) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

/**
 * Extrahiert aus unified-court-calendar.tsx (16.09.2026, tokensave-Fund:
 * 2175 Zeilen/CC 229 in einer einzigen Funktion). Reiner JSX-Ausschnitt ohne
 * Logikänderung — Zustand bleibt bewusst im Elternteil, weil dieselben
 * Setter auch vom Inline-Panel (kein Modal) im Kalender selbst befüllt
 * werden.
 */
export function BlockCourtDialog({
  open,
  onClose,
  courtId,
  courts,
  date,
  timeSlot,
  blockType,
  onBlockTypeChange,
  weatherData,
  duration,
  onDurationChange,
  reason,
  onReasonChange,
  onSubmit,
  loading,
}: BlockCourtDialogProps) {
  return (
    <CenteredModal open={open} onClose={onClose}>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Platz sperren
        </h2>
        <p className="text-sm text-muted-foreground">
          Sperrt den Platz {courtId && courts.find((c) => c.id === courtId)?.name} am{' '}
          {format(date, 'dd.MM.yyyy', { locale: de })} um {timeSlot} Uhr.
        </p>
      </div>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="block-type">Sperrtyp</Label>
          <div className="flex gap-2">
            <Button
              variant={blockType === 'event' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onBlockTypeChange('event')}
              className="gap-1.5"
            >
              <PartyPopper className="h-4 w-4" />
              Veranstaltung
            </Button>
            <Button
              variant={blockType === 'maintenance' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onBlockTypeChange('maintenance')}
              className="gap-1.5"
            >
              <Wrench className="h-4 w-4" />
              Wartung
            </Button>
            <Button
              variant={blockType === 'weather' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                onBlockTypeChange('weather');
                if (weatherData && !reason) {
                  onReasonChange(
                    `${weatherData.description} (${Math.round(weatherData.temperature)}°C)`
                  );
                }
              }}
              className="gap-1.5"
            >
              <CloudRain className="h-4 w-4" />
              Wetter
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="block-duration">Dauer (Stunden)</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((h) => (
              <Button
                key={h}
                variant={duration === h ? 'default' : 'outline'}
                size="sm"
                onClick={() => onDurationChange(h)}
              >
                {h}h
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="block-reason">Grund (optional)</Label>
          <Input
            id="block-reason"
            placeholder={
              blockType === 'event'
                ? 'z.B. Firmenevent, Turnier...'
                : blockType === 'weather'
                  ? 'z.B. Regen, Frost, Sturm...'
                  : 'z.B. Platzreparatur...'
            }
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {loading ? 'Sperre wird gesetzt...' : 'Platz sperren'}
        </Button>
      </div>
    </CenteredModal>
  );
}
