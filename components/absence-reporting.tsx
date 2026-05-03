'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  Plus,
  Edit,
  Save,
  XCircle,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  Download,
  Sick,
  Plane,
  User as UserIcon,
  MoreHorizontal,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';

export interface Absence {
  id: string;
  trainerId: string;
  trainerName: string;
  type: 'sick' | 'vacation' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AbsenceReporting() {
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Absence>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAbsences();
  }, []);

  const loadAbsences = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/absences');
      if (!response.ok) {
        throw new Error('Failed to load absences');
      }
      const data = await response.json();
      setAbsences(data.absences || []);
    } catch (error) {
      console.error('Failed to load absences:', error);
      toast.error('Fehler beim Laden der Abwesenheiten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAbsence = async () => {
    try {
      const response = await fetch('/api/absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create absence');
      }

      const data = await response.json();
      setAbsences([...absences, data.absence]);
      setEditForm({});
      toast.success('Abwesenheit erfolgreich gemeldet');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Melden der Abwesenheit');
      console.error('Create error:', error);
    }
  };

  const handleApproveAbsence = async (id: string) => {
    try {
      const response = await fetch(`/api/absences/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Admin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve absence');
      }

      const data = await response.json();
      setAbsences(absences.map((a) => (a.id === id ? data.absence : a)));
      toast.success('Abwesenheit genehmigt');
    } catch (error) {
      toast.error('Fehler bei der Genehmigung');
      console.error('Approve error:', error);
    }
  };

  const handleRejectAbsence = async (id: string) => {
    try {
      const response = await fetch(`/api/absences/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Admin' }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject absence');
      }

      const data = await response.json();
      setAbsences(absences.map((a) => (a.id === id ? data.absence : a)));
      toast.success('Abwesenheit abgelehnt');
    } catch (error) {
      toast.error('Fehler bei der Ablehnung');
      console.error('Reject error:', error);
    }
  };

  const handleDeleteAbsence = async (id: string) => {
    if (!confirm('Möchten Sie diese Abwesenheit wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/absences/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete absence');
      }

      setAbsences(absences.filter((a) => a.id !== id));
      toast.success('Abwesenheit erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen der Abwesenheit');
      console.error('Delete error:', error);
    }
  };

  const getStatusColor = (status: Absence['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: Absence['status']) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend';
      case 'approved':
        return 'Genehmigt';
      case 'rejected':
        return 'Abgelehnt';
    }
  };

  const getTypeColor = (type: Absence['type']) => {
    switch (type) {
      case 'sick':
        return 'bg-red-100 text-red-700';
      case 'vacation':
        return 'bg-blue-100 text-blue-700';
      case 'personal':
        return 'bg-purple-100 text-purple-700';
      case 'other':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: Absence['type']) => {
    switch (type) {
      case 'sick':
        return 'Krankheit';
      case 'vacation':
        return 'Urlaub';
      case 'personal':
        return 'Persönlich';
      case 'other':
        return 'Sonstiges';
    }
  };

  const getTypeIcon = (type: Absence['type']) => {
    switch (type) {
      case 'sick':
        return <Sick className="h-4 w-4" />;
      case 'vacation':
        return <Plane className="h-4 w-4" />;
      case 'personal':
        return <UserIcon className="h-4 w-4" />;
      case 'other':
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const getDuration = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    return differenceInDays(end, start) + 1;
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Abwesenheit melden</h1>
          <p className="text-gray-500">Verwaltung von Trainerabwesenheiten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Create New Absence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Abwesenheit melden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Trainer</Label>
              <select
                value={editForm.trainerId || ''}
                onChange={(e) => setEditForm({ ...editForm, trainerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Trainer auswählen...</option>
                <option value="trainer-1">Thomas Müller</option>
                <option value="trainer-2">Julia Weber</option>
              </select>
            </div>
            <div>
              <Label>Typ</Label>
              <select
                value={editForm.type || ''}
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Typ auswählen...</option>
                <option value="sick">Krankheit</option>
                <option value="vacation">Urlaub</option>
                <option value="personal">Persönlich</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={editForm.startDate || ''}
                onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Enddatum</Label>
              <Input
                type="date"
                value={editForm.endDate || ''}
                onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Grund</Label>
              <Input
                value={editForm.reason || ''}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                placeholder="Grund für die Abwesenheit..."
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Notizen</Label>
              <Textarea
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
                placeholder="Interne Notizen..."
              />
            </div>
          </div>
          <Button onClick={handleCreateAbsence} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Abwesenheit melden
          </Button>
        </CardContent>
      </Card>

      {/* Absences List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Abwesenheiten</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {absences.map((absence) => (
            <Card key={absence.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        <User className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{absence.trainerName}</div>
                        <div className="text-sm text-gray-600">ID: {absence.trainerId}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(absence.status)}>
                      {getStatusLabel(absence.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={getTypeColor(absence.type)}>
                      {getTypeIcon(absence.type)}
                      <span className="ml-1">{getTypeLabel(absence.type)}</span>
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      <span>
                        {format(parseISO(absence.startDate), 'dd. MMM', { locale: de })} -{' '}
                        {format(parseISO(absence.endDate), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{getDuration(absence.startDate, absence.endDate)} Tage</span>
                    </div>
                  </div>

                  {absence.reason && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Grund:</span> {absence.reason}
                    </div>
                  )}

                  {absence.notes && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Notizen:</span> {absence.notes}
                    </div>
                  )}

                  {absence.approvedBy && (
                    <div className="text-xs text-gray-500">
                      Genehmigt von {absence.approvedBy}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    {absence.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApproveAbsence(absence.id)}
                          className="flex-1"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectAbsence(absence.id)}
                          className="flex-1"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Ablehnen
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteAbsence(absence.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
