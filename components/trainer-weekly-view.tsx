'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, parseISO, isToday } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Download,
  Users,
  BookOpen,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TrainingSession {
  id: string;
  trainerId: string;
  trainerName: string;
  courtId: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'individual' | 'group' | 'trial' | 'competition';
  status: 'scheduled' | 'completed' | 'cancelled' | 'in_progress';
  participants: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function TrainerWeeklyView() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
    // Re-load when selected week changes
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      // Use /api/sessions filtered by date range — the sessions API returns
      // entries with timeslotStart/timeslotEnd which we map to TrainingSession.
      // We need a clubId; read it from the URL if present, otherwise omit it
      // and fall back to an empty list (admin can supply clubId as query param).
      const url = new URL('/api/sessions', window.location.origin);
      const clubIdFromUrl = new URLSearchParams(window.location.search).get('clubId');
      if (clubIdFromUrl) url.searchParams.set('clubId', clubIdFromUrl);
      // Date filter — we apply client-side after fetch since the sessions API
      // returns up to 4 weeks; filter to the selected week below.
      url.searchParams.set('weekStart', weekStartStr);
      url.searchParams.set('weekEnd', weekEndStr);

      if (!clubIdFromUrl) {
        // No clubId available — render empty but don't crash
        setSessions([]);
        return;
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const raw: Array<{
        id: string;
        trainerId?: string;
        trainerName?: string;
        courtName?: string;
        timeslotStart: string;
        timeslotEnd: string;
        maxParticipants?: number;
        bookedByUser?: boolean;
        bookingId?: string | null;
        bookingStatus?: string | null;
      }> = await res.json();

      // Map API shape → TrainingSession shape; keep only this week's sessions
      const mapped: TrainingSession[] = raw
        .filter((s) => {
          const d = s.timeslotStart.substring(0, 10);
          return d >= weekStartStr && d <= weekEndStr;
        })
        .map((s) => {
          const start = new Date(s.timeslotStart);
          const end = new Date(s.timeslotEnd);
          return {
            id: s.id,
            trainerId: s.trainerId ?? '',
            trainerName: s.trainerName ?? 'Trainer',
            courtId: '',
            courtName: s.courtName ?? 'Platz',
            date: start.toISOString().substring(0, 10),
            startTime: start.toTimeString().substring(0, 5),
            endTime: end.toTimeString().substring(0, 5),
            type: 'individual' as const,
            status: 'scheduled' as const,
            participants: [],
            createdAt: s.timeslotStart,
            updatedAt: s.timeslotStart,
          };
        });

      setSessions(mapped);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Fehler beim Laden der Trainingssessions');
    } finally {
      setIsLoading(false);
    }
  };

  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const handleCancelSession = async (sessionId: string) => {
    setCancelConfirmId(sessionId);
  };

  const confirmCancelSession = async () => {
    const sessionId = cancelConfirmId;
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/bookings/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions(
        sessions.map((s) => (s.id === sessionId ? { ...s, status: 'cancelled' as const } : s))
      );
      toast.success('Trainingssession erfolgreich abgesagt');
    } catch (error) {
      toast.error('Fehler beim Absagen der Trainingssession');
      console.error('Cancel error:', error);
    } finally {
      setCancelConfirmId(null);
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/bookings/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSessions(
        sessions.map((s) => (s.id === sessionId ? { ...s, status: 'completed' as const } : s))
      );
      toast.success('Trainingssession als abgeschlossen markiert');
    } catch (error) {
      toast.error('Fehler beim Abschließen der Trainingssession');
      console.error('Complete error:', error);
    }
  };

  const getStatusColor = (status: TrainingSession['status']) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const getStatusLabel = (status: TrainingSession['status']) => {
    switch (status) {
      case 'scheduled':
        return 'Geplant';
      case 'completed':
        return 'Abgeschlossen';
      case 'cancelled':
        return 'Abgesagt';
      case 'in_progress':
        return 'Läuft';
    }
  };

  const getTypeColor = (type: TrainingSession['type']) => {
    switch (type) {
      case 'individual':
        return 'bg-purple-100 text-purple-700';
      case 'group':
        return 'bg-orange-100 text-orange-700';
      case 'trial':
        return 'bg-green-100 text-green-700';
      case 'competition':
        return 'bg-red-100 text-red-700';
    }
  };

  const getTypeLabel = (type: TrainingSession['type']) => {
    switch (type) {
      case 'individual':
        return 'Einzeltraining';
      case 'group':
        return 'Gruppentraining';
      case 'trial':
        return 'Probetraining';
      case 'competition':
        return 'Wettkampf';
    }
  };

  const getFilteredSessions = () => {
    let filtered = sessions;

    if (selectedTrainerId !== 'all') {
      filtered = filtered.filter((s) => s.trainerId === selectedTrainerId);
    }

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    filtered = filtered.filter((s) => {
      const sessionDate = parseISO(s.date);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });

    return filtered;
  };

  const getWeekDays = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  };

  const getSessionsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return getFilteredSessions().filter((s) => s.date === dateStr);
  };

  const getTrainerIds = () => {
    const ids = new Set(sessions.map((s) => s.trainerId));
    return Array.from(ids);
  };

  const getTrainerName = (trainerId: string) => {
    const session = sessions.find((s) => s.trainerId === trainerId);
    return session?.trainerName || 'Unbekannt';
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>

        <ConfirmDialog
          open={cancelConfirmId !== null}
          onOpenChange={(open) => !open && setCancelConfirmId(null)}
          title="Trainingssession absagen"
          description="Möchten Sie diese Trainingssession wirklich absagen?"
          confirmLabel="Absagen"
          variant="danger"
          onConfirm={confirmCancelSession}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Trainer-Wochenansicht</h1>
          <p className="text-gray-500">Übersicht aller Trainingssessions pro Woche</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neue Session
          </Button>
        </div>

        <ConfirmDialog
          open={cancelConfirmId !== null}
          onOpenChange={(open) => !open && setCancelConfirmId(null)}
          title="Trainingssession absagen"
          description="Möchten Sie diese Trainingssession wirklich absagen?"
          confirmLabel="Absagen"
          variant="danger"
          onConfirm={confirmCancelSession}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <Select value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Alle Trainer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Trainer</SelectItem>
              {getTrainerIds().map((id) => (
                <SelectItem key={id} value={id}>
                  {getTrainerName(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(addDays(selectedDate, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'dd. MMM', { locale: de })} -{' '}
            {format(addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), 6), 'dd. MMM yyyy', {
              locale: de,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(addDays(selectedDate, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
          Heute
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Gesamt</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getFilteredSessions().length}</div>
            <p className="text-xs text-gray-500 mt-1">Trainingssessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Geplant</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getFilteredSessions().filter((s) => s.status === 'scheduled').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Ausstehend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Abgeschlossen</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getFilteredSessions().filter((s) => s.status === 'completed').length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Erfolgreich</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Teilnehmer</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getFilteredSessions().reduce((sum, s) => sum + s.participants.length, 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Gesamt</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
          <div key={day} className="text-center font-medium text-sm text-gray-600 py-2">
            {day}
          </div>
        ))}

        {getWeekDays().map((date) => {
          const daySessions = getSessionsForDate(date);
          const isTodayDate = isToday(date);

          return (
            <Card
              key={date.toISOString()}
              className={`min-h-[300px] ${isTodayDate ? 'border-brand-primary border-2' : ''}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm ${isTodayDate ? 'text-brand-primary' : ''}`}>
                    {format(date, 'd', { locale: de })}
                  </CardTitle>
                  {isTodayDate && (
                    <Badge variant="default" className="text-xs">
                      Heute
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {daySessions.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 py-4">Keine Sessions</div>
                ) : (
                  daySessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-2 rounded border cursor-pointer hover:shadow-md transition-shadow"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedSession(session);
                        }
                      }}
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">
                          {session.startTime} - {session.endTime}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${getStatusColor(session.status)}`}
                        >
                          {getStatusLabel(session.status)}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">{session.trainerName}</div>
                      <div className="flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-600">{session.courtName}</span>
                      </div>
                      <div className="flex items-center gap-1 mb-1">
                        <Badge className={`text-[10px] ${getTypeColor(session.type)}`}>
                          {getTypeLabel(session.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-600">
                          {session.participants.length} Teilnehmer
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Trainingssession Details</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setSelectedSession(null)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getStatusColor(selectedSession.status)}>
                  {getStatusLabel(selectedSession.status)}
                </Badge>
                <Badge className={getTypeColor(selectedSession.type)}>
                  {getTypeLabel(selectedSession.type)}
                </Badge>
              </div>

              {/* Trainer Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Trainer
                </h3>
                <div className="text-sm">
                  <div className="font-medium">{selectedSession.trainerName}</div>
                  <div className="text-gray-600">ID: {selectedSession.trainerId}</div>
                </div>
              </div>

              {/* Training Information */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Trainingstermin
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Datum:</span>
                    <span className="ml-2 font-medium">
                      {format(parseISO(selectedSession.date), 'EEEE, dd. MMMM yyyy', {
                        locale: de,
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Uhrzeit:</span>
                    <span className="ml-2 font-medium">
                      {selectedSession.startTime} - {selectedSession.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Platz:</span>
                    <span className="font-medium">{selectedSession.courtName}</span>
                  </div>
                </div>
              </div>

              {/* Participants */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Teilnehmer ({selectedSession.participants.length})
                </h3>
                <div className="space-y-2">
                  {selectedSession.participants.map((participant) => (
                    <div key={participant.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{participant.name}</div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                        {participant.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{participant.email}</span>
                          </div>
                        )}
                        {participant.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{participant.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedSession.notes && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Notizen
                  </h3>
                  <p className="text-sm text-gray-700">{selectedSession.notes}</p>
                </div>
              )}

              {/* Actions */}
              {selectedSession.status === 'scheduled' && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      handleCompleteSession(selectedSession.id);
                      setSelectedSession(null);
                    }}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Abschließen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleCancelSession(selectedSession.id);
                      setSelectedSession(null);
                    }}
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Absagen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
