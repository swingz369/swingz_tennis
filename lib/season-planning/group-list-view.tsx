'use client';

import { DAYS, DAY_LABELS } from './schedule-constants';
import type { ScheduleSlot } from './types';

interface GroupListViewProps {
  plan: ScheduleSlot[];
  expandedSlot: string | null;
  byDay: Record<number, ScheduleSlot[]>;
  activeDays: number[];
  onToggleExpand: (slotId: string) => void;
  onMoveMember: (
    fromId: string,
    personId: string,
    personName: string,
    toId: string,
  ) => void;
}

export default function GroupListView({
  plan,
  expandedSlot,
  byDay,
  activeDays,
  onToggleExpand,
  onMoveMember,
}: GroupListViewProps) {
  if (plan.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Kein Plan generiert
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-5">
      {activeDays.map((day) => (
        <div
          key={day}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          {/* Day header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200">
            <div className="w-8 h-8 rounded-lg bg-[#1A2E44] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {DAYS[day - 1]}
            </div>
            <h2 className="font-semibold text-gray-900 text-sm">
              {DAY_LABELS[day - 1]}
            </h2>
            <span className="text-xs text-gray-400">
              {byDay[day].length} Gruppe{byDay[day].length > 1 ? 'n' : ''}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {byDay[day].reduce((s, g) => s + g.memberNames.length, 0)}{' '}
              Mitglieder gesamt
            </span>
          </div>
          {/* Groups for this day */}
          <div className="divide-y divide-gray-100">
            {byDay[day]
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .map((slot) => (
                <div key={slot.id} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: slot.groupColor }}
                    />
                    <p className="font-medium text-gray-900 text-sm">
                      {slot.groupName}
                    </p>
                    <span className="text-xs text-gray-400">
                      {slot.startTime}–{slot.endTime} Uhr · {slot.trainerName}{' '}
                      · {slot.courtName}
                    </span>
                    <button
                      onClick={() =>
                        onToggleExpand(
                          slot.id === expandedSlot ? '' : slot.id,
                        )
                      }
                      className="ml-auto text-xs text-blue-600 hover:text-blue-800 flex-shrink-0"
                    >
                      {expandedSlot === slot.id
                        ? 'Schließen'
                        : 'Mitglieder verschieben'}
                    </button>
                  </div>
                  {/* Member chips */}
                  <div className="flex flex-wrap gap-1.5 ml-6">
                    {slot.memberNames.map((name, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 text-xs rounded-full font-medium"
                        style={{
                          background: slot.groupColor + '20',
                          color: slot.groupColor,
                        }}
                      >
                        {name}
                      </span>
                    ))}
                    {slot.memberNames.length === 0 && (
                      <span className="text-xs text-gray-400 italic">
                        Keine Mitglieder
                      </span>
                    )}
                  </div>
                  {/* Member transfer UI */}
                  {expandedSlot === slot.id && (
                    <div className="mt-3 ml-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Mitglied in andere Gruppe verschieben:
                      </p>
                      {slot.memberNames.map((name, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 mb-1.5"
                        >
                          <span className="text-xs text-gray-700 w-36 truncate">
                            {name}
                          </span>
                          <select
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                onMoveMember(
                                  slot.id,
                                  slot.memberIds[i],
                                  name,
                                  e.target.value,
                                );
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">— bleibt hier —</option>
                            {plan
                              .filter((s) => s.id !== slot.id)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.groupName} · {DAYS[s.dayOfWeek - 1]}{' '}
                                  {s.startTime} · {s.trainerName}
                                </option>
                              ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
