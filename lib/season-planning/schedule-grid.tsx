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
  rectIntersection,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DAYS, HOURS } from './schedule-constants';
import type { ScheduleSlot } from './types';
import { GripVertical, Users, Clock, MapPin, User, X, Pencil } from 'lucide-react';

/* ─────────────────── Types ─────────────────── */

interface ScheduleGridProps {
  plan: ScheduleSlot[];
  onSlotMove: (slotId: string, newDay: number, newStartTime: string) => void;
  onSlotUpdate?: (slot: ScheduleSlot) => void;
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
      className={`group relative rounded-lg px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none
        transition-all duration-200 ease-out
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
        <span className="opacity-80 text-[10px]">
          {slot.startTime}–{slot.endTime}
        </span>
      </div>
      <div className="flex items-center gap-1 pl-2.5">
        <Users size={9} className="opacity-70 flex-shrink-0" />
        <span className="opacity-80 text-[10px]">{slot.memberNames.length}M</span>
        {slot.trainerName && (
          <>
            <span className="opacity-50 text-[10px]">·</span>
            <span className="opacity-70 text-[10px] truncate">
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
  slots,
  onEdit,
}: {
  cellId: string;
  slots: ScheduleSlot[];
  onEdit: (slot: ScheduleSlot) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  const hasSlots = slots.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[56px] border-b border-r p-1 transition-all duration-150
        ${
          isOver
            ? 'bg-brand-primary/10 ring-2 ring-inset ring-brand-primary/30'
            : hasSlots
              ? 'bg-muted/40'
              : 'hover:bg-muted/30'
        }
        border-border
      `}
    >
      {/* Empty cell drop hint */}
      {isOver && !hasSlots && (
        <div className="absolute inset-1 rounded-md border-2 border-dashed border-brand-primary/30 flex items-center justify-center">
          <span className="text-[10px] text-brand-primary/50 font-medium">Ablegen</span>
        </div>
      )}

      {/* Slots in this cell */}
      <div className="flex flex-col gap-0.5">
        {slots.map((slot) => (
          <DraggableSlotCard key={slot.id} slot={slot} onEdit={onEdit} />
        ))}
      </div>
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
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md mx-4 overflow-hidden"
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
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
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setDay(i + 1)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all
                    ${
                      day === i + 1
                        ? 'bg-brand-primary text-white shadow-sm'
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
            >
              {HOURS.map((h) => (
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
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
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm
                focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all"
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
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
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

      const parts = overId.split('-');
      const newDay = parseInt(parts[1], 10);
      const newHour = parts[2];

      if (newDay === slot.dayOfWeek && newHour === slot.startTime) return;

      onSlotMove(slot.id, newDay, newHour);
    },
    [onSlotMove]
  );

  const handleSlotUpdate = useCallback(
    (updated: ScheduleSlot) => {
      if (onSlotUpdate) onSlotUpdate(updated);
    },
    [onSlotUpdate]
  );

  // Build a map: cellKey -> ScheduleSlot[]
  const cellMap = new Map<string, ScheduleSlot[]>();
  for (const slot of plan) {
    const key = `${slot.dayOfWeek}-${slot.startTime}`;
    const arr = cellMap.get(key) ?? [];
    arr.push(slot);
    cellMap.set(key, arr);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveSlot(null)}
      >
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground text-sm">Wochenstundenplan</h2>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {plan.length} Gruppen
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <GripVertical size={12} />
              Drag & Drop zum Verschieben
            </p>
          </div>

          {/* Grid */}
          <div className="overflow-x-auto">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '56px repeat(7, 1fr)',
                minWidth: '700px',
              }}
            >
              {/* Day headers */}
              <div className="h-9 border-b border-r border-border bg-muted/30" />
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="h-9 border-b border-r border-border bg-muted/30 flex items-center justify-center text-xs font-semibold text-muted-foreground"
                >
                  {d}
                </div>
              ))}

              {/* Time rows */}
              {HOURS.map((hour, hi) => {
                const nextHour = HOURS[hi + 1] ?? '22:00';
                return (
                  <React.Fragment key={`row-${hour}`}>
                    {/* Time label */}
                    <div className="min-h-[56px] border-b border-r border-border flex items-start justify-end pr-1.5 pt-1.5 bg-muted/20">
                      <span className="text-[11px] text-muted-foreground tabular-nums">{hour}</span>
                    </div>
                    {/* Day cells */}
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const cellId = `cell-${day}-${hour}`;
                      const slotsInCell = (cellMap.get(`${day}-${hour}`) ?? []).filter(
                        (s) => s.startTime >= hour && s.startTime < nextHour
                      );
                      return (
                        <DroppableCell
                          key={cellId}
                          cellId={cellId}
                          slots={slotsInCell}
                          onEdit={setEditingSlot}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

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
