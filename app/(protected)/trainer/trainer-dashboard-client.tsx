'use client';

import { ProfessionalCard } from '@/components/ui/professional/professional-card';
import { Calendar, Users } from 'lucide-react';

export interface TrainerSession {
  id: string;
  week: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  notes?: string;
}

interface Props {
  trainer: { id: string; name: string };
  sessions: TrainerSession[];
}

export function TrainerDashboardClient({ trainer, sessions }: Props) {
  const dayNames: Record<number, string> = {
    1: 'Montag',
    2: 'Dienstag',
    3: 'Mittwoch',
    4: 'Donnerstag',
    5: 'Freitag',
    6: 'Samstag',
    7: 'Sonntag',
  };

  const sessionsByDay: Record<number, TrainerSession[]> = {};
  sessions.forEach((s) => {
    if (!sessionsByDay[s.dayOfWeek]) sessionsByDay[s.dayOfWeek] = [];
    sessionsByDay[s.dayOfWeek].push(s);
  });

  const sortedDays = Object.keys(sessionsByDay)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B4332]">Trainer Dashboard</h1>
        <p className="text-gray-500">Willkommen, {trainer.name}</p>
      </div>

      {/* Sessions by Day */}
      {sortedDays.length === 0 ? (
        <ProfessionalCard variant="bordered" className="p-6">
          <div className="text-center py-8 text-gray-500">
            Keine kommenden Sessions in den nächsten 30 Tagen
          </div>
        </ProfessionalCard>
      ) : (
        sortedDays.map((day) => {
          const dayName = dayNames[day] ?? '';
          return (
            <div key={day} className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">{dayName}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessionsByDay[day].map((session) => (
                  <ProfessionalCard key={session.id} variant="bordered" className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.startTime} – {session.endTime}
                        </p>
                        {session.notes && (
                          <p className="text-xs text-gray-500 mt-1">{session.notes}</p>
                        )}
                      </div>
                      <Calendar className="h-4 w-4 text-gray-400" />
                    </div>

                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        <span>Max. {session.maxParticipants} Teilnehmer</span>
                      </div>
                      <button
                        className="mt-2 w-full py-1 px-3 bg-brand-primary-50 text-brand-primary-700 rounded text-xs hover:bg-brand-primary-100 transition-colors"
                        disabled
                      >
                        Teilnehmerliste (bald verfügbar)
                      </button>
                    </div>
                  </ProfessionalCard>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
