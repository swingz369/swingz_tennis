'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Attendee {
  bookingId: string;
  memberName: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show';
}

interface Session {
  id: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  attendees: Attendee[];
}

interface DashboardStats {
  totalSessions: number;
  upcomingSessions: number;
  sessionsThisWeek: number;
  noShows: number;
  totalAttendees: number;
}

export default function TrainerDashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/trainer/me');
        if (!res.ok) throw new Error('Failed to fetch trainer data');
        const json = await res.json();
        setSessions(json.sessions || []);
        setStats(json.stats);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) return <div className="p-6">Laden...</div>;
  if (error) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Trainer Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Gesamte Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalSessions || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kommende</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.upcomingSessions || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Diese Woche</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.sessionsThisWeek || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>No-Shows</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.noShows || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Meine Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zeit
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Teilnehmer
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.map((session: Session) => (
                  <tr key={session.id}>
                    <td className="px-4 py-2 text-sm">
                      {new Date(session.startTime).toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      <br />
                      <span className="text-gray-500">
                        bis{' '}
                        {new Date(session.endTime).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {session.attendees.map((a, i) => (
                        <div key={i}>{a.memberName}</div>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {session.attendees.map((a, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center px-2 py-1 rounded text-xs mr-1 mb-1 font-medium ${getStatusColor(a.status)}`}
                        >
                          {a.status}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {session.attendees.map(
                        (a, i) =>
                          a.status === 'confirmed' && (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-600 mr-1 mb-1 rounded"
                            >
                              Kontaktieren Sie den Admin für No-Show
                            </span>
                          )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
