'use client';

/**
 * Geteilte Kopfzeilen-Bausteine des Platzkalenders — Ansichts-Umschalter und
 * Rollen-Aktionen (Export, Sperren, Einheit eintragen). Von Agenda- UND
 * Wochen-/Tagesansicht genutzt, damit beide nicht auseinanderlaufen.
 * Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2).
 */
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download, List, Lock } from 'lucide-react';
import type { ViewMode } from '@/hooks/use-calendar-state';

export function CalendarViewToggle({
  viewMode,
  setViewMode,
  isAdmin,
  isTrainer,
}: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isAdmin: boolean;
  isTrainer: boolean;
}) {
  return (
    <div className="flex rounded-xl border border-border overflow-hidden">
      <Button
        variant={viewMode === 'agenda' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none"
        onClick={() => setViewMode('agenda')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Heute
      </Button>
      <Button
        variant={viewMode === 'weekly' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-x border-border"
        onClick={() => setViewMode('weekly')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Woche
      </Button>
      <Button
        variant={viewMode === 'month' ? 'default' : 'ghost'}
        size="sm"
        className="rounded-none border-r border-border"
        onClick={() => setViewMode('month')}
      >
        <CalendarIcon className="h-4 w-4 mr-1.5" />
        Monat
      </Button>
      {(isAdmin || isTrainer) && (
        <Button
          variant={viewMode === 'daily' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-r border-border"
          onClick={() => setViewMode('daily')}
        >
          <CalendarIcon className="h-4 w-4 mr-1.5" />
          Tag (Planung)
        </Button>
      )}
      {isAdmin && (
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none"
          onClick={() => setViewMode('list')}
        >
          <List className="h-4 w-4 mr-1.5" />
          Liste
        </Button>
      )}
    </div>
  );
}

export function CalendarRoleActions({
  isAdmin,
  isTrainer,
  viewMode,
  selectedDate,
  selectedCourtId,
  courts,
  handleExportICS,
  openBlockDialog,
  openAdHocDialog,
}: {
  isAdmin: boolean;
  isTrainer: boolean;
  viewMode: ViewMode;
  selectedDate: Date;
  selectedCourtId: string | null;
  courts: { id: string }[];
  handleExportICS: () => void;
  openBlockDialog: (courtId: string, date: Date, timeSlot: string) => void;
  openAdHocDialog: (courtId: string, date: Date, timeSlot: string) => void;
}) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={handleExportICS}>
        <Download className="h-4 w-4 mr-2" />
        ICS
      </Button>
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const d = viewMode === 'daily' || viewMode === 'agenda' ? selectedDate : new Date();
            openBlockDialog(selectedCourtId ?? courts[0]?.id ?? '', d, '10:00');
          }}
        >
          <Lock className="h-4 w-4" />
          Sperren
        </Button>
      )}
      {isTrainer && !isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const d = viewMode === 'daily' || viewMode === 'agenda' ? selectedDate : new Date();
            openAdHocDialog(selectedCourtId ?? courts[0]?.id ?? '', d, '10:00');
          }}
        >
          <CalendarIcon className="h-4 w-4" />
          Einheit eintragen
        </Button>
      )}
    </>
  );
}
