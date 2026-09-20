'use client';

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DAYS, HOURS, START_TIMES } from './schedule-constants';
import type { ScheduleSlot } from './types';
import { GripVertical, Users, Clock, MapPin, User, X, Pencil } from 'lucide-react';
import { CalendarShell } from '@/components/calendar/CalendarShell';

/* ─────────────────── Types ─────────────────── */

interface ScheduleGridProps {
  plan: ScheduleSlot[];
  onSlotMove: (slotId: string, newDay: number, newStartTime: string) => void;
  onSlotUpdate?: (slot: ScheduleSlot) => void;
}

/**
 * Höhe einer Stundenzeile und Höhe der Kopfzeile (`h-9`) in Pixeln.
 *
 * Die Termine werden nicht in ihre Stundenzelle gelegt, sondern über die
 * ganze Tagesspalte — nur so kann ein 90- oder 120-Minuten-Training die
 * Zeilengrenze überschreiten, ohne dass die Zelle darunter es für freie Zeit
 * hält. Aus beiden Konstanten folgt die Pixelposition jedes Termins.
 */
const ROW_HEIGHT_PX = 56;
const HEADER_HEIGHT_PX = 36;
/** Erste Rasterzeile (HOURS[0] = "08:00") in Minuten. */
const GRID_START_MIN = 8 * 60;
/** Breite der Zeitspalte, identisch mit `gridTemplateColumns`. */
const TIME_COL_PX = 56;

export interface PositionedSlot {
  slot: ScheduleSlot;
  /** Spalte innerhalb der überlappenden Gruppe, 0-basiert. */
  lane: number;
  /** Anzahl Spalten, die sich diese überlappende Gruppe teilt. */
  lanes: number;
}

/**
 * Ordnet die Termine eines Tages nebeneinander an, wenn sie sich zeitlich
 * überschneiden.
 *
 * Vorher teilten sich nur Termine derselben *Stundenzelle* die Breite. Bei
 * 60-Minuten-Einheiten fiel das nicht auf; sobald ein Training 90 oder 120
 * Minuten dauert, überlappt es aber Termine aus den folgenden Zeilen, und
 * zwei Blöcke lagen unbemerkt übereinander — der hintere war schlicht
 * unsichtbar. Maßgeblich ist deshalb das Zeitintervall, nicht die Zeile.
 *
 * Verfahren: nach Beginn sortieren, zusammenhängend überlappende Termine zu
 * einem Bündel sammeln und innerhalb des Bündels jedem Termin die erste
 * Spalte geben, in der er nicht mit dem Vorgänger kollidiert.
 */
export function layoutDayColumn(slots: ScheduleSlot[]): PositionedSlot[] {
  const ranged = slots
    .map((slot) => {
      const start = toMinutes(slot.startTime);
      return { slot, start, end: start + slotDurationMin(slot), lane: 0 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const positioned: PositionedSlot[] = [];
  let bundle: typeof ranged = [];
  let laneEnds: number[] = [];

  const flush = () => {
    for (const item of bundle) {
      positioned.push({ slot: item.slot, lane: item.lane, lanes: laneEnds.length });
    }
    bundle = [];
    laneEnds = [];
  };

  for (const item of ranged) {
    // Ein neues Bündel beginnt, sobald der Termin keinen der laufenden mehr
    // schneidet — dann darf er wieder die volle Breite bekommen.
    if (laneEnds.length > 0 && item.start >= Math.max(...laneEnds)) flush();

    const free = laneEnds.findIndex((end) => end <= item.start);
    item.lane = free === -1 ? laneEnds.length : free;
    laneEnds[item.lane] = item.end;
    bundle.push(item);
  }
  flush();

  return positioned;
}

/** Dauer in Minuten, mit Mindestmaß damit ein Termin greifbar bleibt. */
function slotDurationMin(slot: ScheduleSlot): number {
  return Math.max(slot.durationMin || 60, 25);
}

/** "15:30" → 930. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Neue Startzeit nach dem Ablegen in einer Stundenzeile: Stunde vom Ziel,
 * Minuten vom Termin.
 *
 * Ablegeziel ist immer eine volle Stunde, weil das Raster stundenweise
 * gegliedert ist. Würde daraus stur eine volle Startzeit, verstellte
 * „Gruppe auf einen anderen Tag schieben" nebenbei die Uhrzeit — ein
 * Training um 15:30 wäre nach dem Verschieben um 15:00 gewesen, ohne dass
 * es jemand so wollte. Die Uhrzeit ändert man im Bearbeiten-Fenster.
 */
export function movedStartTime(slotStartTime: string, targetHour: string): string {
  return `${targetHour.slice(0, 2)}:${slotStartTime.slice(3, 5)}`;
}

/* ─────────────────── Draggable Slot Card ─────────────────── */

function DraggableSlotCard({
  slot,
  isOverlay = false,
  onEdit,
}: {
  slot: ScheduleSlot;
  isOverlay?: boolean;
  onEdit?: (slot: ScheduleSlot) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slot-${slot.id}`,
    data: { slot },
  });

  const opacity = isDragging && !isOverlay ? 0.3 : 1;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      className={`group relative rounded-xl px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none
        transition-all duration-200 ease-out
        ${isOverlay ? '' : 'h-full overflow-hidden'}
        ${
          isOverlay
            ? 'shadow-2xl scale-105 rotate-1 ring-2 ring-white/50'
            : 'shadow-sm hover:shadow-md hover:scale-[1.02] ring-1 ring-inset ring-black/5'
        }
        ${isDragging && !isOverlay ? 'opacity-30' : ''}
      `}
      style={{
        background: `linear-gradient(135deg, ${slot.groupColor}, ${slot.groupColor}dd)`,
        color: '#fff',
        opacity,
        touchAction: 'none',
      }}
    >
      {/* Drag handle indicator */}
      {!isOverlay && (
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
          <GripVertical size={12} />
        </div>
      )}

      <p className="font-semibold text-[11px] leading-tight truncate pl-2.5">{slot.groupName}</p>
      <div className="flex items-center gap-1 mt-0.5 pl-2.5">
        <Clock size={9} className="opacity-70 flex-shrink-0" />
        <span className="opacity-80 text-2xs">
          {slot.startTime}–{slot.endTime}
        </span>
      </div>
      <div className="flex items-center gap-1 pl-2.5">
        <Users size={9} className="opacity-70 flex-shrink-0" />
        <span className="opacity-80 text-2xs">{slot.memberNames.length}M</span>
        {slot.trainerName && (
          <>
            <span className="opacity-50 text-2xs">·</span>
            <span className="opacity-70 text-2xs truncate">
              {slot.trainerName.split(' ').pop()}
            </span>
          </>
        )}
      </div>

      {/* Edit button on hover */}
      {!isOverlay && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(slot);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity
            bg-white/20 hover:bg-white/40 rounded p-0.5"
        >
          <Pencil size={10} />
        </button>
      )}
    </div>
  );
}

/* ─────────────────── Droppable Cell ─────────────────── */

function DroppableCell({
  cellId,
  occupied,
}: {
  cellId: string;
  /** Liegt in dieser Stunde ein Training? Nur für die Flächenfarbe. */
  occupied: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  const hasSlots = occupied;

  return (
    <div
      ref={setNodeRef}
      style={{ height: ROW_HEIGHT_PX }}
      className={`relative border-b border-r transition-colors duration-150
        ${
          isOver
            ? 'bg-primary/10 ring-2 ring-inset ring-primary/30'
            : hasSlots
              ? 'bg-muted/40'
              : 'hover:bg-muted/30'
        }
        border-border
      `}
    >
      {/* Halbstunden-Markierung. Ohne sie bliebe die Position eines Termins
          eine Schätzung: die Zeitspalte beschriftet nur volle Stunden, und ob
          ein Block bei 15:00 oder 15:20 ansetzt, sieht man sonst nicht. Eine
          Linie pro Zeile genügt dafür — eine Minutenskala kostet vierfache
          Zeilenzahl für denselben Zweck. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/60" />

      {/* Empty cell drop hint */}
      {isOver && !hasSlots && (
        <div className="absolute inset-1 rounded-md border-2 border-dashed border-primary/30 flex items-center justify-center">
          <span className="text-2xs text-primary/50 font-medium">Ablegen</span>
        </div>
      )}
    </div>
  );
}

/**
 * Die Termine eines Tages, über die ganze Spalte gelegt.
 *
 * Liegt als eigene Ebene über den Ablegezellen: `pointer-events-none` auf der
 * Ebene, `auto` auf den Karten — so bleiben die Zellen darunter Ablegeziel und
 * die Karten greifbar.
 */
function DayColumnSlots({
  day,
  slots,
  onEdit,
}: {
  day: number;
  slots: ScheduleSlot[];
  onEdit: (slot: ScheduleSlot) => void;
}) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        top: HEADER_HEIGHT_PX,
        bottom: 0,
        left: `calc(${TIME_COL_PX}px + ${day} * (100% - ${TIME_COL_PX}px) / 6)`,
        width: `calc((100% - ${TIME_COL_PX}px) / 6)`,
      }}
    >
      {layoutDayColumn(slots).map(({ slot, lane, lanes }) => (
        <div
          key={slot.id}
          className="pointer-events-auto absolute px-0.5"
          style={{
            top: (toMinutes(slot.startTime) - GRID_START_MIN) * (ROW_HEIGHT_PX / 60),
            height: slotDurationMin(slot) * (ROW_HEIGHT_PX / 60),
            left: `${(lane * 100) / lanes}%`,
            width: `${100 / lanes}%`,
          }}
        >
          <DraggableSlotCard slot={slot} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Edit Modal ─────────────────── */

function SlotEditModal({
  slot,
  onClose,
  onSave,
}: {
  slot: ScheduleSlot;
  onClose: () => void;
  onSave: (updated: ScheduleSlot) => void;
}) {
  const [day, setDay] = useState(slot.dayOfWeek);
  const [startTime, setStartTime] = useState(slot.startTime);
  const [trainerName, setTrainerName] = useState(slot.trainerName);
  const [courtName, setCourtName] = useState(slot.courtName ?? '');

  const handleSave = () => {
    const [sh, sm] = startTime.split(':').map(Number);
    const tot = sh * 60 + sm + slot.durationMin;
    const newEnd = `${Math.floor(tot / 60)
      .toString()
      .padStart(2, '0')}:${(tot % 60).toString().padStart(2, '0')}`;

    onSave({
      ...slot,
      dayOfWeek: day,
      startTime,
      endTime: newEnd,
      trainerName,
      courtName: courtName || null,
    });
    onClose();
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit slot ${slot.groupName}`}
        className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm"
              style={{ background: slot.groupColor }}
            />
            <div>
              <h3 className="font-semibold text-foreground">{slot.groupName}</h3>
              <p className="text-xs text-muted-foreground">{slot.memberNames.length} Mitglieder</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Day selector */}
          <div>
            <span
              id="slot-edit-day"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Wochentag
            </span>
            <div role="group" aria-labelledby="slot-edit-day" className="flex gap-1">
              {/* Mo-Sa only — Sonntag ist kein Trainingstag (Vereinsrealität) */}
              {DAYS.slice(0, 6).map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDay(i)}
                  className={`flex-1 py-2 text-xs font-medium rounded-xl transition-all
                    ${
                      day === i
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-muted dark:bg-muted text-muted-foreground hover:bg-muted/80 dark:hover:bg-muted/80'
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Start time */}
          <div>
            <label
              htmlFor="slot-edit-start"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              Startzeit
            </label>
            <select
              id="slot-edit-start"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            >
              {/* Viertelstunden, nicht nur volle Stunden: sonst liessen sich
                  die vom Clustering erzeugten Starts um halb im Fenster gar
                  nicht abbilden — beim Öffnen wäre die Auswahl auf einen
                  fremden Wert gesprungen. */}
              {START_TIMES.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* Trainer */}
          <div>
            <label
              htmlFor="slot-edit-trainer"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              <User size={12} className="inline mr-1" />
              Trainer
            </label>
            <input
              id="slot-edit-trainer"
              type="text"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {/* Court */}
          <div>
            <label
              htmlFor="slot-edit-court"
              className="block text-xs font-medium text-muted-foreground mb-1.5"
            >
              <MapPin size={12} className="inline mr-1" />
              Platz
            </label>
            <input
              id="slot-edit-court"
              type="text"
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              placeholder="z.B. Platz 1"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>

          {/* Members preview */}
          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              <Users size={12} className="inline mr-1" />
              Mitglieder ({slot.memberNames.length})
            </span>
            <div className="flex flex-wrap gap-1">
              {slot.memberNames.map((name, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium"
                  style={{ background: slot.groupColor + '20', color: slot.groupColor }}
                >
                  {name}
                </span>
              ))}
              {slot.memberNames.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Keine Mitglieder</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-xl transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Main Grid Component ─────────────────── */

export default function ScheduleGrid({ plan, onSlotMove, onSlotUpdate }: ScheduleGridProps) {
  const [activeSlot, setActiveSlot] = useState<ScheduleSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const slot = event.active.data.current?.slot as ScheduleSlot | undefined;
    if (slot) setActiveSlot(slot);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveSlot(null);
      const { active, over } = event;
      if (!over) return;

      const slot = active.data.current?.slot as ScheduleSlot | undefined;
      if (!slot) return;

      const overId = over.id.toString();
      // Cell ID format: cell-{day}-{hour}
      if (!overId.startsWith('cell-')) return;

      // Format: cell-{day}-{HH:MM} — use indexOf to safely split at second dash
      const firstDash = overId.indexOf('-');
      const secondDash = overId.indexOf('-', firstDash + 1);
      const newDay = parseInt(overId.slice(firstDash + 1, secondDash), 10);
      const newHour = overId.slice(secondDash + 1);

      const newStartTime = movedStartTime(slot.startTime, newHour);

      if (newDay === slot.dayOfWeek && newStartTime === slot.startTime) return;

      onSlotMove(slot.id, newDay, newStartTime);
    },
    [onSlotMove]
  );

  const handleSlotUpdate = useCallback(
    (updated: ScheduleSlot) => {
      if (onSlotUpdate) onSlotUpdate(updated);
    },
    [onSlotUpdate]
  );

  // Termine je Tag — die Spalte ist die Einheit, nicht die Stundenzelle.
  const slotsByDay = new Map<number, ScheduleSlot[]>();
  for (const slot of plan) {
    const arr = slotsByDay.get(slot.dayOfWeek) ?? [];
    arr.push(slot);
    slotsByDay.set(slot.dayOfWeek, arr);
  }

  /**
   * Belegt eine Stundenzeile? Gefragt ist die Überschneidung mit dem
   * Zeitraum des Termins, nicht dessen Startstunde: die zweite Hälfte eines
   * 90-Minuten-Trainings gehört zur Stunde danach, und die galt vorher als
   * freie Fläche.
   */
  const isOccupied = (day: number, hour: string) => {
    const from = toMinutes(hour);
    const to = from + 60;
    return (slotsByDay.get(day) ?? []).some((s) => {
      const start = toMinutes(s.startTime);
      return start < to && start + slotDurationMin(s) > from;
    });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveSlot(null)}
      >
        <CalendarShell
          title="Wochenstundenplan"
          subtitle="Drag & Drop zum Verschieben"
          controls={
            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {plan.length} Gruppen
            </span>
          }
        >
          {/* Grid — Mo-Sa only — Sonntag ist kein Trainingstag (Vereinsrealität) */}
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm overflow-x-auto">
            {/* Zwei Ebenen: das Raster aus Ablegezellen, darüber je Tag die
                Termine. Getrennt, weil ein Termin länger als eine Stunde sein
                darf — als Kind seiner Stundenzelle könnte er die Zeile nicht
                überschreiten, ohne dass die Zelle darunter ihn übersieht. */}
            <div className="relative" style={{ minWidth: '700px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `${TIME_COL_PX}px repeat(6, 1fr)`,
                }}
              >
                {/* Day headers */}
                <div
                  style={{ height: HEADER_HEIGHT_PX }}
                  className="border-b border-r border-border bg-muted/30"
                />
                {DAYS.slice(0, 6).map((d) => (
                  <div
                    key={d}
                    style={{ height: HEADER_HEIGHT_PX }}
                    className="border-b border-r border-border bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}

                {/* Time rows */}
                {HOURS.map((hour) => (
                  <React.Fragment key={`row-${hour}`}>
                    {/* Time label */}
                    <div
                      style={{ height: ROW_HEIGHT_PX }}
                      className="border-b border-r border-border flex items-start justify-end pr-1.5 pt-1.5 bg-muted/20"
                    >
                      <span className="text-[11px] text-muted-foreground tabular-nums">{hour}</span>
                    </div>
                    {/* Day cells — index matches DayOfWeek convention (0=Mo..5=Sa) */}
                    {[0, 1, 2, 3, 4, 5].map((day) => (
                      <DroppableCell
                        key={`cell-${day}-${hour}`}
                        cellId={`cell-${day}-${hour}`}
                        occupied={isOccupied(day, hour)}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>

              {[0, 1, 2, 3, 4, 5].map((day) => (
                <DayColumnSlots
                  key={`slots-${day}`}
                  day={day}
                  slots={slotsByDay.get(day) ?? []}
                  onEdit={setEditingSlot}
                />
              ))}
            </div>
          </div>
        </CalendarShell>

        {/* Drag Overlay — rendered outside the grid for proper positioning */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
          {activeSlot ? <DraggableSlotCard slot={activeSlot} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* Edit Modal */}
      {editingSlot && (
        <SlotEditModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={handleSlotUpdate}
        />
      )}
    </>
  );
}
