'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Check, X, Loader2, UserCheck } from 'lucide-react';
import { useSessionRsvps } from '@/hooks/use-rsvp';
import { toast } from 'sonner';
import { asUtcIso, formatTime as formatTimeBerlin, formatWeekdayDate } from '@/lib/format';
import { apiFetch } from '@/lib/api-fetch';

interface TrainerRsvpListProps {
  sessions: Array<{
    id: string;
    startTime: string;
    endTime: string;
    timeslot_start?: string;
    timeslot_end?: string;
  }>;
  trainerId?: string;
  trainerName?: string;
  /** Von außen gesteuerte Auswahl — der "Anwesenheit"-Knopf einer Einheit
   *  öffnet damit direkt deren Teilnehmerliste. */
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
}

export function TrainerRsvpList({
  sessions,
  trainerId,
  trainerName,
  selectedSessionId: controlledSessionId,
  onSelectSession,
}: TrainerRsvpListProps) {
  const effectiveTrainerId = trainerId || 'unknown';
  const effectiveTrainerName = trainerName || 'Trainer';
  const [ownSessionId, setOwnSessionId] = useState<string | null>(null);
  const selectedSessionId = controlledSessionId ?? ownSessionId;
  const setSelectedSessionId = (id: string) => {
    setOwnSessionId(id);
    onSelectSession?.(id);
  };
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [checkingIn, setCheckingIn] = useState(false);

  // Auto-select first upcoming session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setOwnSessionId(sessions[0].id);
    }
  }, [sessions, selectedSessionId]);

  const { data: rsvps = [], isLoading } = useSessionRsvps(selectedSessionId);

  const accepted = rsvps.filter((r) => r.status === 'accepted');
  const declined = rsvps.filter((r) => r.status === 'declined');
  const maybe = rsvps.filter((r) => r.status === 'maybe');
  const handleCheckIn = async (_rsvpId: string, memberId: string, memberName: string) => {
    if (checkedIn.has(memberId)) return;
    setCheckingIn(true);
    try {
      // Das Datum des Anwesenheitseintrags ist der Termin der Einheit, nicht der
      // Zeitpunkt des Klicks. Vorher stand hier `new Date()`: Ein am 12.08.
      // vorbereiteter Check-in für das Training am 03.11. landete unter dem
      // 12.08. und verfälschte jede spätere Anwesenheitsauswertung.
      const selected = sessions.find((s) => s.id === selectedSessionId);
      const sessionStart = selected?.startTime || selected?.timeslot_start;
      const today = sessionStart
        ? new Date(asUtcIso(sessionStart) as string).toISOString()
        : new Date().toISOString();
      const res = await apiFetch('/api/attendance-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          participantId: memberId,
          participantName: memberName || 'Mitglied',
          trainerId: effectiveTrainerId,
          trainerName: effectiveTrainerName,
          date: today,
          status: 'present',
          checkInTime: new Date().toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }),
      });
      if (!res.ok) throw new Error('Check-in failed');
      setCheckedIn((prev) => new Set(prev).add(memberId));
      toast.success('Teilnehmer eingecheckt ✅');
    } catch (_error) {
      toast.error('Check-in fehlgeschlagen');
    } finally {
      setCheckingIn(false);
    }
  };

  // `timeslot_start` trägt keine Zeitzone (siehe asUtcIso in @/lib/format) —
  // date-fns hätte den Wert als deutsche Ortszeit gelesen und ein
  // 18:00-Training als 16:00 angezeigt.
  const formatTime = (iso: string) => formatTimeBerlin(asUtcIso(iso));
  const formatDate = (iso: string) => formatWeekdayDate(asUtcIso(iso));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-primary" />
          Session-Teilnehmer & RSVPs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Selector */}
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Keine bevorstehenden Sessions
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {sessions.slice(0, 10).map((session) => {
                const isSelected = session.id === selectedSessionId;
                const startIso = session.startTime || session.timeslot_start || '';
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-muted text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div>{formatDate(startIso)}</div>
                    <div className="opacity-80">{formatTime(startIso)}</div>
                  </button>
                );
              })}
            </div>

            {/* RSVP Summary */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <Badge
                    variant="default"
                    className="bg-success-100 text-success-700 border-success-200"
                  >
                    {accepted.length} zugesagt
                  </Badge>
                  <Badge variant="default" className="bg-error-100 text-error-700 border-error-200">
                    {declined.length} abgesagt
                  </Badge>
                  <Badge
                    variant="default"
                    className="bg-warning-100 text-warning-700 border-warning-200"
                  >
                    {maybe.length} vielleicht
                  </Badge>
                </div>

                {/* Accepted list with check-in */}
                {accepted.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-success-700 mb-2 flex items-center gap-1">
                      <Check className="h-4 w-4" /> Zugesagt ({accepted.length})
                    </h4>
                    <div className="space-y-1">
                      {accepted.map((rsvp) => {
                        const memberId = rsvp.memberId;
                        const isCheckedIn = checkedIn.has(memberId);
                        return (
                          <div
                            key={rsvp.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl text-sm ${
                              isCheckedIn ? 'bg-success-50 border border-success-200' : 'bg-muted'
                            }`}
                          >
                            <span className="font-medium">{rsvp.user?.fullName || 'Mitglied'}</span>
                            {isCheckedIn ? (
                              <Badge variant="default" className="bg-success-600 text-white">
                                <UserCheck className="h-3 w-3 mr-1" /> Eingecheckt
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleCheckIn(
                                    rsvp.id,
                                    memberId,
                                    rsvp.user?.fullName || 'Mitglied'
                                  )
                                }
                                disabled={checkingIn}
                                className="h-7 text-xs"
                              >
                                <UserCheck className="h-3 w-3 mr-1" />
                                Check-in
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Maybe list */}
                {maybe.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-warning-700 mb-2">
                      Vielleicht ({maybe.length})
                    </h4>
                    <div className="space-y-1">
                      {maybe.map((rsvp) => (
                        <div
                          key={rsvp.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-warning-50 text-sm"
                        >
                          <span className="font-medium">{rsvp.user?.fullName || 'Mitglied'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Declined list */}
                {declined.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-error-700 mb-2 flex items-center gap-1">
                      <X className="h-4 w-4" /> Abgesagt ({declined.length})
                    </h4>
                    <div className="space-y-1">
                      {declined.map((rsvp) => (
                        <div
                          key={rsvp.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-error-50 text-sm"
                        >
                          <span className="font-medium">{rsvp.user?.fullName || 'Mitglied'}</span>
                          <Badge variant="outline" className="text-error-600 border-error-200">
                            Abwesend
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
