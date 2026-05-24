'use client';

import React from 'react';
import { DAYS, HOURS } from './schedule-constants';
import type { ScheduleSlot } from './types';

interface ScheduleGridProps {
  plan: ScheduleSlot[];
  dragging: ScheduleSlot | null;
  dragOver: string | null;
  onDragStart: (slot: ScheduleSlot) => void;
  onDragEnd: () => void;
  onDragOver: (key: string) => void;
  onDrop: (e: React.DragEvent, day: number, hour: string) => void;
}

export default function ScheduleGrid({
  plan,
  dragging,
  dragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: ScheduleGridProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Wochenstundenplan</h2>
        <p className="text-xs text-gray-400">Drag &amp; Drop zum Verschieben</p>
      </div>
      <div className="overflow-x-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '56px repeat(7,1fr)',
            minWidth: '700px',
          }}
        >
          {/* Day headers */}
          <div className="h-8 border-b border-r border-gray-100" />
          {DAYS.map((d) => (
            <div
              key={d}
              className="h-8 border-b border-r border-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500"
            >
              {d}
            </div>
          ))}

          {/* Time rows */}
          {HOURS.map((hour, hi) => (
            <React.Fragment key={`row-${hour}`}>
              <div className="h-14 border-b border-r border-gray-100 flex items-start justify-end pr-1.5 pt-1">
                <span className="text-xs text-gray-400">{hour}</span>
              </div>
              {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                const key = `${day}-${hour}`;
                const nextHour = HOURS[hi + 1] ?? '22:00';
                const here = plan.filter(
                  (s) => s.dayOfWeek === day && s.startTime >= hour && s.startTime < nextHour
                );
                return (
                  <div
                    key={key}
                    className={`h-14 border-b border-r border-gray-100 p-0.5 transition-colors ${
                      dragOver === key ? 'bg-blue-50' : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      onDragOver(key);
                    }}
                    onDrop={(e) => onDrop(e, day, hour)}
                  >
                    {here.map((slot) => (
                      <div
                        key={slot.id}
                        draggable
                        onDragStart={() => onDragStart(slot)}
                        onDragEnd={onDragEnd}
                        title={`${slot.groupName}\n${slot.memberNames.join(', ')}`}
                        className="rounded text-xs px-1.5 py-0.5 cursor-grab select-none"
                        style={{
                          background: slot.groupColor,
                          color: '#fff',
                          opacity: dragging?.id === slot.id ? 0.4 : 1,
                        }}
                      >
                        <p className="font-semibold truncate leading-tight">{slot.groupName}</p>
                        <p className="opacity-75 text-[10px]">
                          {slot.startTime} · {slot.memberNames.length}M ·{' '}
                          {slot.trainerName.split(' ').pop()}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
