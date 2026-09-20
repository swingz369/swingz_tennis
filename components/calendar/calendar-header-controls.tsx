'use client';

/**
 * Geteilte Kopfzeilen-Bausteine des Platzkalenders — Ansichts-Umschalter und
 * Rollen-Aktionen (Export, Sperren, Einheit eintragen). Von Agenda- UND
 * Wochen-/Tagesansicht genutzt, damit beide nicht auseinanderlaufen.
 * Ausgelagert aus unified-court-calendar.tsx (Sanierungsplan Phase 2.2).
 */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar as CalendarIcon, Download, Lock, MoreHorizontal } from 'lucide-react';
import type { ViewMode } from '@/hooks/use-calendar-state';

const DAY_MODES: ViewMode[] = ['agenda', 'matrix', 'daily'];

function Segment<T extends string>({
  value,
  onChange,
  items,
  size = 'sm',
}: {
  value: T | null;
  onChange: (v: T) => void;
  items: { value: T; label: string; icon?: ReactNode }[];
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="flex rounded-xl border border-border overflow-hidden">
      {items.map((item, i) => (
        <Button
          key={item.value}
          variant={value === item.value ? 'default' : 'ghost'}
          size="sm"
          className={`rounded-none ${i > 0 ? 'border-l border-border' : ''} ${size === 'xs' ? 'h-7 px-2.5 text-xs' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.icon}
          {item.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Ansichten: Tag | Woche | Monat | Liste. „Tag“ hat einen kleinen Unter-Umschalter
 * (Buchen · Übersicht · Raster) — vorher waren das drei gleichrangige Hauptansichten.
 */
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
  const isDay = DAY_MODES.includes(viewMode);
  const main: 'day' | 'weekly' | 'month' | 'list' = isDay ? 'day' : (viewMode as 'weekly');
  const mainItems: { value: 'day' | 'weekly' | 'month' | 'list'; label: string }[] = [
    { value: 'day', label: 'Tag' },
    { value: 'weekly', label: 'Woche' },
    { value: 'month', label: 'Monat' },
    ...(isAdmin ? [{ value: 'list' as const, label: 'Liste' }] : []),
  ];
  const dayItems: { value: ViewMode; label: string }[] = [
    { value: 'agenda', label: 'Buchen' },
    { value: 'matrix', label: 'Übersicht' },
    ...(isAdmin || isTrainer ? [{ value: 'daily' as ViewMode, label: 'Raster' }] : []),
  ];
  return (
    <>
      <Segment
        value={main}
        items={mainItems}
        onChange={(v) => setViewMode(v === 'day' ? (isDay ? viewMode : 'agenda') : v)}
      />
      {isDay && dayItems.length > 1 && (
        <Segment value={viewMode} items={dayItems} onChange={setViewMode} size="xs" />
      )}
    </>
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
  const openBlock = () => {
    const d = viewMode === 'daily' || viewMode === 'agenda' ? selectedDate : new Date();
    openBlockDialog(selectedCourtId ?? courts[0]?.id ?? '', d, '10:00');
  };
  return (
    <>
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
      {/* Selten gebraucht: Export und Platz sperren wandern ins Menü */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Weitere Aktionen">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleExportICS}>
            <Download className="h-4 w-4 mr-2" />
            Als ICS exportieren
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onSelect={openBlock}>
              <Lock className="h-4 w-4 mr-2" />
              Platz sperren
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
