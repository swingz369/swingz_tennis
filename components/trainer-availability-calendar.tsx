'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, parseISO, isToday } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, User, Plus, ChevronLeft, ChevronRight, Download, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TrainerAvailability {
  id: string;
  trainerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'available' | 'unavailable' | 'booked' | 'blocked';
  notes?: string;
  recurringPattern?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function TrainerAvailabilityCalendar() {
  const [availabilities, setAvailabilities] = useState<TrainerAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('all');
  const [editForm, setEditForm] = useState<Partial<TrainerAvailability>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadAvailabilities();
  }, []);

  const loadAvailabilities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/trainer-availability');
      if (!response.ok) {
        throw new Error('Failed to load availabilities');
      }
      const data = await response.json();
            setAvailabilities(data.availabilities || []);
    } catch (error) {
      console.error('Failed to load availabilities:', error);
      toast.error('Fehler beim Laden der Verfügbarkeiten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAvailability = async () => {
    try {
      const response = await fetch('/api/trainer-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          start_time: editForm.startTime,
          end_time: editForm.endTime,
          notes: editForm.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create availability');
      }

      const data = await response.json();
      const slot = data.slot;
      const now = new Date().toISOString();
      setAvailabilities([...availabilities, {
        id: slot.id,
        trainerId: slot.trainer_id,
        date: slot.date,
        startTime: slot.start_time,
        endTime: slot.end_time,
        status: slot.status,
        notes: slot.notes,
        createdAt: slot.created_at || now,
        updatedAt: slot.updated_at || now,
      }]);
      setEditForm({});
      toast.success('Verfügbarkeit erfolgreich erstellt');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim Erstellen der Verfügbarkeit'
      );
      console.error('Create error:', error);
    }
  };

  const getStatusColor = (status: TrainerAvailability['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'unavailable':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'booked':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'blocked':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: TrainerAvailability['status']) => {
    switch (status) {
      case 'available':
        return 'Verfügbar';
      case 'unavailable':
        return 'Nicht verfügbar';
      case 'booked':
        return 'Gebucht';
      case 'blocked':
        return 'Blockiert';
    }
  };

  const getFilteredAvailabilities = () => {
    let filtered = availabilities;

    if (selectedTrainerId !== 'all') {
      filtered = filtered.filter((a) => a.trainerId === selectedTrainerId);
    }

    if (viewMode === 'week') {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      filtered = filtered.filter((a) => {
        const availDate = parseISO(a.date);
        return availDate >= weekStart && availDate <= weekEnd;
      });
    }

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

  const getAvailabilitiesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return getFilteredAvailabilities().filter((a) => a.date === dateStr);
  };

  const getTrainerIds = () => {
    const ids = new Set(availabilities.map((a) => a.trainerId));
    return Array.from(ids);
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
          <h1 className="text-2xl font-bold text-brand-primary">Trainer-Verfügbarkeitskalender</h1>
          <p className="text-gray-500">Verwaltung der Trainer-Verfügbarkeiten</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Neue Verfügbarkeit
          </Button>
        </div>
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
                  Trainer {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Wochenansicht" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Wochenansicht</SelectItem>
              <SelectItem value="month">Monatsansicht</SelectItem>
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

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
          <div key={day} className="text-center font-medium text-sm text-gray-600 py-2">
            {day}
          </div>
        ))}

        {getWeekDays().map((date) => {
          const dayAvailabilities = getAvailabilitiesForDate(date);
          const isTodayDate = isToday(date);

          return (
            <Card
              key={date.toISOString()}
              className={`min-h-[200px] ${isTodayDate ? 'border-brand-primary border-2' : ''}`}
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
                {dayAvailabilities.length === 0 ? (
                  <div className="text-center text-xs text-gray-400 py-4">
                    Keine Verfügbarkeiten
                  </div>
                ) : (
                  dayAvailabilities.map((availability) => (
                    <div
                      key={availability.id}
                      className={`p-2 rounded border text-xs ${getStatusColor(availability.status)}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {availability.startTime} - {availability.endTime}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {getStatusLabel(availability.status)}
                        </Badge>
                      </div>
                      <div className="text-gray-600">Trainer {availability.trainerId}</div>
                      {availability.recurringPattern && (
                        <div className="flex items-center gap-1 mt-1 text-gray-500">
                          <Repeat className="h-3 w-3" />
                          <span className="text-[10px]">{availability.recurringPattern.type}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create New Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Verfügbarkeit erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Trainer</Label>
              <Select
                value={editForm.trainerId || ''}
                onValueChange={(v) => setEditForm({ ...editForm, trainerId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Trainer auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {getTrainerIds().map((id) => (
                    <SelectItem key={id} value={id}>
                      Trainer {id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={editForm.date || ''}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Startzeit</Label>
              <Input
                type="time"
                value={editForm.startTime || ''}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label>Endzeit</Label>
              <Input
                type="time"
                value={editForm.endTime || ''}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={editForm.status || 'available'}
                onValueChange={(v) =>
                  setEditForm({
                    ...editForm,
                    status: v as 'available' | 'unavailable' | 'booked' | 'blocked',
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Verfügbar</SelectItem>
                  <SelectItem value="unavailable">Nicht verfügbar</SelectItem>
                  <SelectItem value="booked">Gebucht</SelectItem>
                  <SelectItem value="blocked">Blockiert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Wiederholung</Label>
              <Select
                value={editForm.recurringPattern?.type || ''}
                onValueChange={(v) => {
                  const type = v as 'daily' | 'weekly' | 'monthly' | 'yearly' | '';
                  setEditForm({
                    ...editForm,
                    recurringPattern: type ? { type, interval: 1 } : undefined,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Keine Wiederholung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Wiederholung</SelectItem>
                  <SelectItem value="daily">Täglich</SelectItem>
                  <SelectItem value="weekly">Wöchentlich</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                  <SelectItem value="yearly">Jährlich</SelectItem>
                </SelectContent>
              </Select>
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
          <Button onClick={handleCreateAvailability} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Verfügbarkeit erstellen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
