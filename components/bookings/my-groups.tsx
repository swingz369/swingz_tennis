'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { DAY_LABELS } from '@/lib/season-planning/schedule-constants';
import { createLogger } from '@/lib/logger';

const log = createLogger('my-groups');

type MemberGroup = {
  id: string | null;
  name: string;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  trainerName: string | null;
  courtName: string | null;
  participantCount: number;
  seasonName: string | null;
};

/** HH:MM:SS → HH:MM */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '');

/**
 * Zeigt dem Mitglied, in welchen Trainingsgruppen es steht — mit Trainer, Termin,
 * Platz und Gruppengröße. Der Trainingsplan darunter listet die Einzeltermine;
 * diese Karte beantwortet die Frage davor: „In welcher Gruppe bin ich eigentlich?"
 */
export default function MyGroups() {
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/user/member/groups')
      .then((res) => (res.ok ? res.json() : { groups: [] }))
      .then((data) => setGroups(data.groups ?? []))
      .catch((err) => log.error('Gruppen konnten nicht geladen werden', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gruppen werden geladen…
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Meine Gruppen
        </CardTitle>
        <CardDescription>
          {groups.length === 1
            ? 'Deine Trainingsgruppe in dieser Saison'
            : `Deine ${groups.length} Trainingsgruppen in dieser Saison`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map((g, idx) => (
          <div
            key={g.id ?? idx}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border p-3"
          >
            <div>
              <div className="font-medium">{g.name}</div>
              <div className="text-sm text-muted-foreground">
                {g.dayOfWeek !== null && DAY_LABELS[g.dayOfWeek]
                  ? `${DAY_LABELS[g.dayOfWeek]}, ${hhmm(g.startTime)}–${hhmm(g.endTime)}`
                  : 'Termin offen'}
                {g.courtName ? ` · ${g.courtName}` : ''}
              </div>
            </div>
            <div className="text-sm text-muted-foreground sm:text-right">
              <div>{g.trainerName ? `Trainer: ${g.trainerName}` : 'Trainer offen'}</div>
              <div>{g.participantCount} Teilnehmer</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
