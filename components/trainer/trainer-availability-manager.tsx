'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2, Clock, Calendar as CalendarIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

interface TrainerAvailabilityManagerProps {
  trainerId: string;
  clubId: string;
  isAdmin?: boolean;
}

interface WeeklyAvailability {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  notes?: string;
}

interface Absence {
  id?: string;
  start_date: string;
  end_date: string;
  reason: string;
  substitute_trainer_id?: string;
}

const WEEK_DAYS = [
  { value: 1, label: 'Montag', short: 'Mo' },
  { value: 2, label: 'Dienstag', short: 'Di' },
  { value: 3, label: 'Mittwoch', short: 'Mi' },
  { value: 4, label: 'Donnerstag', short: 'Do' },
  { value: 5, label: 'Freitag', short: 'Fr' },
  { value: 6, label: 'Samstag', short: 'Sa' },
  { value: 0, label: 'Sonntag', short: 'So' },
];

export default function TrainerAvailabilityManager({
  trainerId,
  clubId,
  isAdmin = false,
}: TrainerAvailabilityManagerProps) {
  const [availabilities, setAvailabilities] = useState<WeeklyAvailability[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [absenceDialogOpen, setAbsenceDialogOpen] = useState(false);

  // Form states
  const [selectedDay, setSelectedDay] = useState(1);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');

  // Absence form states
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceReason, setAbsenceReason] = useState('');
  const [substituteTrainer, setSubstituteTrainer] = useState('');

  const handleAddAvailability = async () => {
    if (!startTime || !endTime) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    if (startTime >= endTime) {
      toast.error('Startzeit muss vor Endzeit liegen');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/trainer-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainerId,
          club_id: clubId,
          day_of_week: selectedDay,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }

      const data = await response.json();
      setAvailabilities([...availabilities, data.availability]);

      // Reset form
      setStartTime('08:00');
      setEndTime('17:00');
      setNotes('');
      setDialogOpen(false);

      toast.success('Verfügbarkeit erfolgreich hinzugefügt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Speichern');
      console.error('Add availability error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAvailability = async (id: string) => {
    try {
      const response = await apiFetch(`/api/trainer-availability?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen');
      }

      setAvailabilities(availabilities.filter((a) => a.id !== id));
      toast.success('Verfügbarkeit gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen');
      console.error('Delete error:', error);
    }
  };

  const handleAddAbsence = async () => {
    if (!absenceStartDate || !absenceEndDate || !absenceReason) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }

    if (absenceStartDate > absenceEndDate) {
      toast.error('Startdatum muss vor Enddatum liegen');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/trainer-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: trainerId,
          club_id: clubId,
          start_date: absenceStartDate,
          end_date: absenceEndDate,
          reason: absenceReason,
          substitute_trainer_id: substituteTrainer || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }

      const data = await response.json();
      setAbsences([...absences, data.absence]);

      // Reset form
      setAbsenceStartDate('');
      setAbsenceEndDate('');
      setAbsenceReason('');
      setSubstituteTrainer('');
      setAbsenceDialogOpen(false);

      toast.success('Abwesenheit erfolgreich eingetragen');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Speichern');
      console.error('Add absence error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailabilitiesForDay = (dayOfWeek: number) => {
    return availabilities.filter((a) => a.day_of_week === dayOfWeek);
  };

  return (
    <div className="space-y-6">
      {/* Weekly Availability */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-primary" />
              Wöchentliche Verfügbarkeit
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Zeitfenster hinzufügen
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Verfügbarkeit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Wochentag</Label>
                    <Select
                      value={String(selectedDay)}
                      onValueChange={(v) => setSelectedDay(parseInt(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEK_DAYS.map((day) => (
                          <SelectItem key={day.value} value={String(day.value)}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Startzeit</Label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Endzeit</Label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notizen (optional)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="z.B. Nur Anfängertraining"
                    />
                  </div>
                  <Button onClick={handleAddAvailability} disabled={isLoading} className="w-full">
                    {isLoading ? 'Speichern...' : 'Verfügbarkeit hinzufügen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {WEEK_DAYS.map((day) => {
              const dayAvailabilities = getAvailabilitiesForDay(day.value);
              return (
                <div key={day.value} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-brand-primary">{day.label}</h3>
                    {dayAvailabilities.length === 0 && (
                      <Badge variant="outline" className="text-gray-500">
                        Keine Verfügbarkeit
                      </Badge>
                    )}
                  </div>
                  {dayAvailabilities.length > 0 ? (
                    <div className="space-y-2">
                      {dayAvailabilities.map((availability) => (
                        <div
                          key={availability.id}
                          className="flex items-center justify-between bg-green-50 border border-green-200 rounded p-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-green-600" />
                              <span className="font-medium">
                                {availability.start_time} - {availability.end_time}
                              </span>
                              <Badge variant="default" className="bg-green-600">
                                Verfügbar
                              </Badge>
                            </div>
                            {availability.notes && (
                              <p className="text-sm text-gray-600 mt-1 ml-6">
                                {availability.notes}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              availability.id && handleDeleteAvailability(availability.id)
                            }
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Keine Verfügbarkeit für diesen Tag
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Absences */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-brand-primary" />
              Abwesenheiten
            </CardTitle>
            <Dialog open={absenceDialogOpen} onOpenChange={setAbsenceDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Abwesenheit eintragen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Abwesenheit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Von</Label>
                      <Input
                        type="date"
                        value={absenceStartDate}
                        onChange={(e) => setAbsenceStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Bis</Label>
                      <Input
                        type="date"
                        value={absenceEndDate}
                        onChange={(e) => setAbsenceEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Grund</Label>
                    <Select value={absenceReason} onValueChange={setAbsenceReason}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Grund auswählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacation">Urlaub</SelectItem>
                        <SelectItem value="sick">Krankheit</SelectItem>
                        <SelectItem value="training">Weiterbildung</SelectItem>
                        <SelectItem value="personal">Persönlich</SelectItem>
                        <SelectItem value="other">Sonstiges</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isAdmin && (
                    <div>
                      <Label>Vertretung (optional)</Label>
                      <Input
                        type="text"
                        value={substituteTrainer}
                        onChange={(e) => setSubstituteTrainer(e.target.value)}
                        placeholder="Trainer-ID für Vertretung"
                      />
                    </div>
                  )}
                  <Button onClick={handleAddAbsence} disabled={isLoading} className="w-full">
                    {isLoading ? 'Speichern...' : 'Abwesenheit eintragen'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {absences.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Keine Abwesenheiten eingetragen</p>
            </div>
          ) : (
            <div className="space-y-2">
              {absences.map((absence) => (
                <div
                  key={absence.id}
                  className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded p-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium">
                        {new Date(absence.start_date).toLocaleDateString('de-DE')} -{' '}
                        {new Date(absence.end_date).toLocaleDateString('de-DE')}
                      </span>
                      <Badge variant="outline">{absence.reason}</Badge>
                    </div>
                    {absence.substitute_trainer_id && (
                      <p className="text-sm text-gray-600 mt-1 ml-6">
                        Vertretung: Trainer {absence.substitute_trainer_id}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Delete absence logic
                      toast.info('Löschen in Entwicklung');
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
