'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  format,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/infrastructure/external/supabase/client';
import { exportBookingsCSV } from '@/lib/csv-export';

interface Session {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  trainerId: string;
  trainerName?: string;
  groupIds: string[];
  groupNames?: string[];
  maxParticipants: number;
  notes?: string;
  bookedByUser?: boolean;
  bookingId?: string; // ID der Buchung für Cancel/Status-Update
  bookingStatus?: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
}

export default function BookingsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Fetch user's club ID and member ID on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [clubRes, memberRes] = await Promise.all([
          fetch('/api/user/club'),
          fetch('/api/user/member'),
        ]);

        if (clubRes.ok) {
          const clubData = await clubRes.json();
          setClubId(clubData.clubId);
        } else {
          setError('Kein Vereinszugang gefunden');
        }

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          setMemberId(memberData.memberId);
        } else {
          console.warn('Could not fetch member ID');
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
        setError('Fehler beim Laden der Benutzerdaten');
      }
    };
    fetchUserData();
  }, []);

  // Load user roles to determine permissions
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: rolesData } = await supabase
          .from('user_club_memberships')
          .select('role')
          .eq('user_id', user.id);
        if (rolesData) {
          const roles = (rolesData as Array<{ role: string }>).map((m) => m.role);
          setUserRoles(roles);
        }
      } catch (e) {
        console.error('Failed to fetch user roles', e);
      }
    };
    fetchUserRoles();
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions?clubId=${clubId}`);
      const data: Session[] = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  // Fetch sessions when clubId is available
  useEffect(() => {
    if (!clubId) return;
    fetchSessions();
  }, [clubId, fetchSessions]);

  const handleBooking = useCallback(
    async (sessionId: string) => {
      if (!memberId) {
        toast.error('Member-ID nicht verfügbar');
        return;
      }

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, sessionId, clubId }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Booking failed');
        }

        const result = await res.json();

        // Optimistic update: mark session as booked
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId ? { ...s, bookedByUser: true, bookingId: result.bookingId } : s
          )
        );

        toast.success('Buchung erfolgreich');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Buchung fehlgeschlagen';
        toast.error(message);
      }
    },
    [memberId, clubId]
  );

  const handleCancelBooking = useCallback(async (sessionId: string, bookingId: string) => {
    if (!bookingId) return;

    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'member_request' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Cancellation failed');
      }

      toast.success('Buchung storniert');
      // Update session: remove booking
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, bookedByUser: false } : s))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stornierung fehlgeschlagen';
      toast.error(message);
    }
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getSessionsForDay = (date: Date) => {
    const jsDay = date.getDay();
    const apiDay = jsDay === 0 ? 7 : jsDay;
    return sessions.filter((s) => s.dayOfWeek === apiDay);
  };

  const getBookingStatusLabel = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'Bestätigt';
      case 'cancelled':
        return 'Storniert';
      case 'no_show':
        return 'Nicht erschienen';
      case 'pending':
        return 'Ausstehend';
      default:
        return status;
    }
  };

  const handleStatusChange = useCallback(
    async (bookingId: string, newStatus: 'pending' | 'confirmed' | 'cancelled' | 'no_show') => {
      if (!memberId) {
        toast.error('Member-ID nicht verfügbar');
        return;
      }

      try {
        const res = await fetch(`/api/bookings/${bookingId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Status-Update fehlgeschlagen');
        }

        toast.success(`Status geändert zu ${getBookingStatusLabel(newStatus)}`);

        // Optimistic update
        setSessions((prev) =>
          prev.map((s) => (s.bookingId === bookingId ? { ...s, bookingStatus: newStatus } : s))
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Fehler';
        toast.error(message);
      }
    },
    [memberId]
  );

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleExportCSV = () => {
    const data = sessions.map((s) => ({
      id: s.id,
      status: s.bookingStatus || 'n/a',
      bookedAt: new Date().toISOString(),
      session: s.bookedByUser
        ? {
            startTime: s.startTime,
            endTime: s.endTime,
            trainerId: s.trainerId,
            court: s.trainerName || '-',
          }
        : null,
      ...(memberId ? { memberId } : {}),
    }));
    exportBookingsCSV(data);
    toast.success('Buchungs-Export gestartet');
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Buchungen</h1>
          <p className="text-gray-500">Trainingsbuchungen für deinen Verein</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[100px] text-center font-medium text-sm md:text-base">
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Laden...</div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden min-w-[600px]">
            {/* Day headers */}
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
              <div
                key={day}
                className="bg-gray-50 p-2 md:p-3 text-center font-semibold text-gray-700 text-xs md:text-sm"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, idx) => {
              const daySessions = getSessionsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={idx}
                  className={`min-h-[80px] md:min-h-[100px] bg-white p-1 md:p-2 ${!isCurrentMonth ? 'opacity-40' : ''}`}
                >
                  <div className="text-xs font-medium text-gray-500 mb-1">{format(day, 'd')}</div>
                  <div className="space-y-1">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                          session.bookedByUser
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                        }`}
                        onClick={() => !session.bookedByUser && handleBooking(session.id)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="font-medium truncate">{session.startTime}</div>
                          {session.bookedByUser && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (session.bookingId) {
                                  handleCancelBooking(session.id, session.bookingId);
                                }
                              }}
                              className="ml-1 p-0.5 rounded hover:bg-red-100 text-red-600 transition-colors"
                              title="Buchung stornieren"
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px]">
                          <Clock className="h-3 w-3" />
                          <span className="truncate">
                            {session.trainerName || session.trainerId}
                          </span>
                        </div>
                        {session.bookedByUser && session.bookingStatus && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                session.bookingStatus === 'confirmed'
                                  ? 'bg-green-100 text-green-700'
                                  : session.bookingStatus === 'cancelled'
                                    ? 'bg-red-100 text-red-700'
                                    : session.bookingStatus === 'no_show'
                                      ? 'bg-gray-100 text-gray-700'
                                      : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {getBookingStatusLabel(session.bookingStatus)}
                            </span>
                            {(userRoles.includes('admin') ||
                              userRoles.includes('superadmin') ||
                              userRoles.includes('trainer')) && (
                              <select
                                value={session.bookingStatus}
                                onChange={(e) =>
                                  session.bookingId &&
                                  handleStatusChange(
                                    session.bookingId,
                                    e.target.value as
                                      | 'pending'
                                      | 'confirmed'
                                      | 'cancelled'
                                      | 'no_show'
                                  )
                                }
                                className="text-[9px] border rounded px-1 py-0.5 bg-white"
                              >
                                <option value="pending">Ausstehend</option>
                                <option value="confirmed">Bestätigt</option>
                                <option value="cancelled">Storniert</option>
                                <option value="no_show">Nicht erschienen</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
