'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Calendar, Clock, User, Plus, Pencil, Trash2 } from 'lucide-react';

type Session = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  trainerId: string;
  trainerName: string;
  groupIds: string[];
  groupNames: string[];
  maxParticipants: number;
  notes: string;
  clubId: string;
  scheduleId: string;
  bookedByUser?: boolean;
};

export default function SchedulesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clubs, setClubs] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [filterClubId, setFilterClubId] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    dayOfWeek: 1,
    startTime: '10:00',
    endTime: '11:00',
    trainerId: '',
    maxParticipants: 4,
    notes: '',
  });

  const fetchSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterClubId) params.set('clubId', filterClubId);
      if (filterDate) params.set('date', filterDate);

      const res = await fetch(`/api/sessions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, [filterClubId, filterDate]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch trainers (for future use)
      const trainersRes = await fetch('/api/trainer/me');
      if (trainersRes.ok) {
        // trainersData could be used to populate trainer dropdown in session form
      }

      // Fetch clubs (for superadmin filter)
      const clubsRes = await fetch('/api/clubs');
      if (clubsRes.ok) {
        const clubsData = await clubsRes.json();
        setClubs(Array.isArray(clubsData) ? clubsData : []);
      }

      // Fetch sessions
      await fetchSessions();
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchSessions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const method = editingSession ? 'PUT' : 'POST';
      const url = editingSession ? `/api/sessions/${editingSession.id}` : '/api/sessions';

      const body = editingSession ? { ...formData, sessionId: editingSession.id } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(editingSession ? 'Session aktualisiert' : 'Session erstellt');
        setShowDialog(false);
        setEditingSession(null);
        resetForm();
        fetchSessions();
      } else {
        const error = await res.json();
        toast.error(`Fehler: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      console.error('Failed to save session:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Session wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Session gelöscht');
        fetchSessions();
      } else {
        toast.error('Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      toast.error('Fehler beim Löschen');
    }
  };

  const resetForm = () => {
    setFormData({
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '11:00',
      trainerId: '',
      maxParticipants: 4,
      notes: '',
    });
  };

  const openEditDialog = (session: Session) => {
    setEditingSession(session);
    setFormData({
      dayOfWeek: session.dayOfWeek,
      startTime: session.startTime,
      endTime: session.endTime,
      trainerId: session.trainerId,
      maxParticipants: session.maxParticipants,
      notes: session.notes,
    });
    setShowDialog(true);
  };

  const getDayName = (dayNum: number) => {
    const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return days[dayNum % 7];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Sessions verwalten</h1>
          <p className="text-gray-500">Trainingsplan für deinen Verein</p>
        </div>
        <Button
          onClick={() => {
            setEditingSession(null);
            resetForm();
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Neue Session
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="w-48">
              <Label htmlFor="filterClub">Verein</Label>
              <Select value={filterClubId} onValueChange={setFilterClubId}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Vereine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Vereine</SelectItem>
                  {clubs.map((club) => (
                    <SelectItem key={club.id} value={club.id}>
                      {club.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label htmlFor="filterDate">Datum</Label>
              <Input
                id="filterDate"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilterClubId('all');
                  setFilterDate('');
                  fetchSessions();
                }}
              >
                Zurücksetzen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trainingssessions</CardTitle>
          <CardDescription>{sessions.length} Sessions gefunden</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Noch keine Sessions geplant</p>
              <Button variant="link" onClick={() => setShowDialog(true)}>
                Erste Session anlegen
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Uhrzeit</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Gruppen</TableHead>
                  <TableHead>Max. Teiln.</TableHead>
                  <TableHead>Notizen</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{getDayName(session.dayOfWeek)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {session.startTime} – {session.endTime}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {session.trainerName}
                      </div>
                    </TableCell>
                    <TableCell>{session.groupNames?.join(', ') || '-'}</TableCell>
                    <TableCell>{session.maxParticipants}</TableCell>
                    <TableCell className="text-sm text-gray-500">{session.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(session)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(session.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{editingSession ? 'Session bearbeiten' : 'Neue Session'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dayOfWeek">Tag</Label>
                    <Select
                      value={formData.dayOfWeek.toString()}
                      onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Montag</SelectItem>
                        <SelectItem value="2">Dienstag</SelectItem>
                        <SelectItem value="3">Mittwoch</SelectItem>
                        <SelectItem value="4">Donnerstag</SelectItem>
                        <SelectItem value="5">Freitag</SelectItem>
                        <SelectItem value="6">Samstag</SelectItem>
                        <SelectItem value="7">Sonntag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="trainerId">Trainer</Label>
                    <Select
                      value={formData.trainerId}
                      onValueChange={(v) => setFormData({ ...formData, trainerId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Trainer wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo-trainer">Max Mustermann</SelectItem>
                        <SelectItem value="demo-trainer-2">Anna Schmidt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Beginn</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">Ende</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="maxParticipants">Max. Teilnehmer</Label>
                  <Input
                    id="maxParticipants"
                    type="number"
                    min="1"
                    value={formData.maxParticipants}
                    onChange={(e) =>
                      setFormData({ ...formData, maxParticipants: parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="z.B. Anfänger, Intensiv, etc."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDialog(false);
                      setEditingSession(null);
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Speichern...' : 'Speichern'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
