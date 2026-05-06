'use client';

import { useState } from 'react';
import { format, addDays, addMonths, isBefore, isAfter } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Repeat, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface SeriesBookingFormProps {
  clubId: string;
  courtId: string;
  onSuccess?: (bookingIds: string[]) => void;
  onCancel?: () => void;
}

type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

interface BookingPreview {
  date: string;
  startTime: string;
  endTime: string;
  status: 'valid' | 'conflict' | 'warning';
  message?: string;
}

export default function SeriesBookingForm({
  clubId,
  courtId,
  onSuccess,
  onCancel,
}: SeriesBookingFormProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday by default
  const [occurrences, setOccurrences] = useState(12);
  const [endDate, setEndDate] = useState('');
  const [useOccurrences, setUseOccurrences] = useState(true);
  const [previews, setPreviews] = useState<BookingPreview[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const weekDays = [
    { label: 'Mo', value: 1 },
    { label: 'Di', value: 2 },
    { label: 'Mi', value: 3 },
    { label: 'Do', value: 4 },
    { label: 'Fr', value: 5 },
    { label: 'Sa', value: 6 },
    { label: 'So', value: 0 },
  ];

  const frequencyLabels = {
    daily: 'Täglich',
    weekly: 'Wöchentlich',
    biweekly: 'Alle 2 Wochen',
    monthly: 'Monatlich',
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort();
    });
  };

  const generatePreviews = () => {
    if (!startDate || !startTime || !endTime) {
      return;
    }

    // Generate preview dates
    const preview: BookingPreview[] = [];
    let currentDate = new Date(startDate);
    const maxDate = endDate ? new Date(endDate) : addMonths(currentDate, 12);
    const maxOccurrences = useOccurrences ? occurrences : 52;
    let count = 0;

    while (count < maxOccurrences && !isAfter(currentDate, maxDate)) {
      // Check if this date matches the pattern
      let shouldAdd = false;

      if (frequency === 'daily') {
        shouldAdd = true;
      } else if (frequency === 'weekly') {
        shouldAdd = selectedDays.includes(currentDate.getDay());
      } else if (frequency === 'biweekly') {
        const weeksDiff = Math.floor(
          (currentDate.getTime() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
        );
        shouldAdd = weeksDiff % 2 === 0 && selectedDays.includes(currentDate.getDay());
      } else if (frequency === 'monthly') {
        shouldAdd = currentDate.getDate() === new Date(startDate).getDate();
      }

      if (shouldAdd && !isBefore(currentDate, new Date(startDate))) {
        preview.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          startTime,
          endTime,
          status: 'valid',
        });
        count++;
      }

      // Move to next day
      currentDate = addDays(currentDate, 1);

      // Safety break
      if (preview.length > 100) {
        break;
      }
    }

    setPreviews(preview.slice(0, 52)); // Limit to 52 bookings max
  };

  const validateBookings = async () => {
    if (previews.length === 0) {
      toast.error('Bitte generieren Sie zuerst eine Vorschau');
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch('/api/bookings/validate-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          court_id: courtId,
          bookings: previews.map((p) => ({
            date: p.date,
            start_time: p.startTime,
            end_time: p.endTime,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Validierung fehlgeschlagen');
      }

      const data = await response.json();
      const updatedPreviews = previews.map((preview, index) => ({
        ...preview,
        status: data.results[index].valid ? 'valid' : 'conflict',
        message: data.results[index].error,
      }));

      setPreviews(updatedPreviews as BookingPreview[]);

      const validCount = updatedPreviews.filter((p) => p.status === 'valid').length;
      const conflictCount = updatedPreviews.length - validCount;

      if (conflictCount > 0) {
        toast.warning(`${validCount} Buchungen möglich, ${conflictCount} Konflikte gefunden`);
      } else {
        toast.success('Alle Buchungen sind verfügbar');
      }
    } catch (error) {
      toast.error('Fehler bei der Validierung');
      console.error('Validation error:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const createSeriesBooking = async () => {
    const validBookings = previews.filter((p) => p.status === 'valid');

    if (validBookings.length === 0) {
      toast.error('Keine gültigen Buchungen vorhanden');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/bookings/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          court_id: courtId,
          start_time: new Date(`${startDate}T${startTime}`),
          end_time: new Date(`${startDate}T${endTime}`),
          recurring_pattern: {
            frequency,
            interval: 1,
            days_of_week:
              frequency === 'weekly' || frequency === 'biweekly' ? selectedDays : undefined,
            occurrences: useOccurrences ? occurrences : undefined,
            end_date: !useOccurrences && endDate ? endDate : undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Erstellen der Serienbuchung');
      }

      const data = await response.json();

      toast.success(
        `${data.bookingIds.length} Buchungen erfolgreich erstellt${
          data.errors.length > 0 ? `, ${data.errors.length} fehlgeschlagen` : ''
        }`
      );

      if (onSuccess) {
        onSuccess(data.bookingIds);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen');
      console.error('Create error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusIcon = (status: BookingPreview['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <Info className="h-4 w-4 text-yellow-600" />;
    }
  };

  const validCount = previews.filter((p) => p.status === 'valid').length;
  const conflictCount = previews.filter((p) => p.status === 'conflict').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-brand-primary" />
          Serienbuchung erstellen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Base Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Startdatum</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div>
            <Label>Startzeit</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label>Endzeit</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        {/* Frequency */}
        <div>
          <Label>Wiederholung</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            {Object.entries(frequencyLabels).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={frequency === key ? 'default' : 'outline'}
                onClick={() => setFrequency(key as Frequency)}
                className="w-full"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Days of Week (for weekly/biweekly) */}
        {(frequency === 'weekly' || frequency === 'biweekly') && (
          <div>
            <Label>Wochentage</Label>
            <div className="flex gap-2 mt-2">
              {weekDays.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                  onClick={() => handleDayToggle(day.value)}
                  size="sm"
                  className="flex-1"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* End Condition */}
        <div>
          <Label>Ende der Serie</Label>
          <div className="space-y-3 mt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={useOccurrences}
                onCheckedChange={(checked) => setUseOccurrences(checked as boolean)}
              />
              <Label className="font-normal">
                Nach{' '}
                <Input
                  type="number"
                  value={occurrences}
                  onChange={(e) => setOccurrences(parseInt(e.target.value) || 1)}
                  min={1}
                  max={52}
                  disabled={!useOccurrences}
                  className="inline-block w-20 mx-1"
                />{' '}
                Terminen
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={!useOccurrences}
                onCheckedChange={(checked) => setUseOccurrences(!checked)}
              />
              <Label className="font-normal">
                Am{' '}
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={useOccurrences}
                  min={startDate}
                  className="inline-block w-40 mx-1"
                />
              </Label>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={generatePreviews} className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            Vorschau generieren
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={validateBookings}
            disabled={previews.length === 0 || isValidating}
            className="flex-1"
          >
            <Clock className="h-4 w-4 mr-2" />
            {isValidating ? 'Prüfen...' : 'Verfügbarkeit prüfen'}
          </Button>
        </div>

        {/* Preview List */}
        {previews.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Vorschau ({previews.length} Termine)</Label>
              <div className="flex gap-2">
                {validCount > 0 && (
                  <Badge variant="default" className="bg-green-600">
                    {validCount} verfügbar
                  </Badge>
                )}
                {conflictCount > 0 && <Badge variant="error">{conflictCount} Konflikte</Badge>}
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Klicken Sie auf &quot;Verfügbarkeit prüfen&quot; um zu sehen, welche Termine noch
                verfügbar sind.
              </AlertDescription>
            </Alert>

            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-3">
              {previews.map((preview, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded border ${
                    preview.status === 'valid'
                      ? 'bg-green-50 border-green-200'
                      : preview.status === 'conflict'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(preview.status)}
                    <span className="text-sm font-medium">
                      {format(new Date(preview.date), 'EEE, dd. MMM yyyy', { locale: de })}
                    </span>
                    <span className="text-sm text-gray-600">
                      {preview.startTime} - {preview.endTime}
                    </span>
                  </div>
                  {preview.message && (
                    <span className="text-xs text-gray-600">{preview.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Button */}
        <div className="flex gap-2 pt-4 border-t">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
          <Button
            type="button"
            onClick={createSeriesBooking}
            disabled={validCount === 0 || isCreating}
            className="flex-1"
          >
            {isCreating ? 'Erstelle...' : `${validCount} Buchungen erstellen`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
