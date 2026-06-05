'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Check, X, Loader2, UserCheck } from 'lucide-react';
import { useSessionRsvps } from '@/hooks/use-rsvp';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from '@/lib/locale';
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
}

export function TrainerRsvpList({ sessions, trainerId, trainerName }: TrainerRsvpListProps) {
  const effectiveTrainerId = trainerId || 'unknown';
  const effectiveTrainerName = trainerName || 'Trainer';
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [checkingIn, setCheckingIn] = useState(false);

  // Auto-select first upcoming session
  useEffect(() => {
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
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
      const today = new Date().toISOString();
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

  const formatTime = (iso: string) => {
    try {
      return format(new Date(iso), 'HH:mm');
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return format(new Date(iso), 'EEEE, dd.MM.', { locale: de });
    } catch {
      return iso;
    }
  };

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
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
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
                  <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                    {accepted.length} zugesagt
                  </Badge>
                  <Badge variant="default" className="bg-red-100 text-red-700 border-red-200">
                    {declined.length} abgesagt
                  </Badge>
                  <Badge variant="default" className="bg-amber-100 text-amber-700 border-amber-200">
                    {maybe.length} vielleicht
                  </Badge>
                </div>

                {/* Accepted list with check-in */}
                {accepted.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      <Check className="h-4 w-4" /> Zugesagt ({accepted.length})
                    </h4>
                    <div className="space-y-1">
                      {accepted.map((rsvp) => {
                        const memberId = rsvp.memberId;
                        const isCheckedIn = checkedIn.has(memberId);
                        return (
                          <div
                            key={rsvp.id}
                            className={`flex items-center justify-between p-2.5 rounded-lg text-sm ${
                              isCheckedIn ? 'bg-green-50 border border-green-200' : 'bg-muted'
                            }`}
                          >
                            <span className="font-medium">{rsvp.user?.fullName || 'Mitglied'}</span>
                            {isCheckedIn ? (
                              <Badge variant="default" className="bg-green-600 text-white">
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
                    <h4 className="text-sm font-medium text-amber-700 mb-2">
                      Vielleicht ({maybe.length})
                    </h4>
                    <div className="space-y-1">
                      {maybe.map((rsvp) => (
                        <div
                          key={rsvp.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 text-sm"
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
                    <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                      <X className="h-4 w-4" /> Abgesagt ({declined.length})
                    </h4>
                    <div className="space-y-1">
                      {declined.map((rsvp) => (
                        <div
                          key={rsvp.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 text-sm"
                        >
                          <span className="font-medium">{rsvp.user?.fullName || 'Mitglied'}</span>
                          <Badge variant="outline" className="text-red-600 border-red-200">
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
