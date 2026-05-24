'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, AlertCircle, CheckCircle2, Repeat, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  useBookingValidation,
  formatValidationError,
  getBookingRulesSummary,
} from '@/hooks/use-booking-validation';
import SeriesBookingForm from './series-booking-form';

interface EnhancedBookingFormProps {
  clubId: string;
  userId: string;
  userRole: 'member' | 'trainer' | 'admin' | 'superadmin';
  courtId?: string;
  onSuccess?: () => void;
}

export default function EnhancedBookingForm({
  clubId,
  userId,
  userRole,
  courtId: initialCourtId,
  onSuccess,
}: EnhancedBookingFormProps) {
  const { validateBooking, isValidating, lastValidation, getBookingRules } = useBookingValidation();

  const [bookingType, setBookingType] = useState<'single' | 'series'>('single');
  const [courtId, setCourtId] = useState(initialCourtId || '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [courts, setCourts] = useState<Array<{ id: string; name: string }>>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [bookingRules, setBookingRules] = useState<any>(null);
  const [validationChecked, setValidationChecked] = useState(false);

  // Load courts and booking rules
  useEffect(() => {
    loadCourts();
    loadBookingRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, userRole]);

  const loadCourts = async () => {
    try {
      const response = await fetch(`/api/courts?club_id=${clubId}`);
      if (response.ok) {
        const data = await response.json();
        setCourts(data.courts || []);
      }
    } catch (error) {
      console.error('Failed to load courts:', error);
    }
  };

  const loadBookingRules = async () => {
    const rules = await getBookingRules(clubId, userRole);
    setBookingRules(rules);
  };

  const handleValidate = async () => {
    if (!courtId || !date || !startTime || !endTime) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (startDateTime >= endDateTime) {
      toast.error('Startzeit muss vor Endzeit liegen');
      return;
    }

    const result = await validateBooking({
      user_id: userId,
      club_id: clubId,
      court_id: courtId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
    });

    setValidationChecked(true);

    if (result.is_valid) {
      toast.success('Buchung ist möglich!');
    } else {
      toast.error(formatValidationError(result));
    }
  };

  const handleCreateBooking = async () => {
    if (!lastValidation || !lastValidation.is_valid) {
      toast.error('Bitte zuerst Verfügbarkeit prüfen');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          court_id: courtId,
          start_time: new Date(`${date}T${startTime}`).toISOString(),
          end_time: new Date(`${date}T${endTime}`).toISOString(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Erstellen der Buchung');
      }

      toast.success('Buchung erfolgreich erstellt');

      // Reset form
      setDate('');
      setStartTime('');
      setEndTime('');
      setValidationChecked(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Erstellen');
      console.error('Create booking error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getDurationMinutes = () => {
    if (!startTime || !endTime) return 0;
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return Math.floor((end.getTime() - start.getTime()) / 60000);
  };

  const duration = getDurationMinutes();
  const showValidationStatus = validationChecked && lastValidation;

  return (
    <div className="space-y-6">
      {/* Booking Rules Info */}
      {bookingRules && (
        <Card className="border-brand-primary/20 bg-brand-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-brand-primary" />
              Buchungsregeln für {userRole === 'member' ? 'Mitglieder' : userRole}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {getBookingRulesSummary(bookingRules).map((rule, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-gray-700">{rule}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Booking Type Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-primary" />
            Neue Buchung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={bookingType} onValueChange={(v) => setBookingType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">
                <Calendar className="h-4 w-4 mr-2" />
                Einzelbuchung
              </TabsTrigger>
              <TabsTrigger value="series" disabled={!bookingRules?.allow_recurring}>
                <Repeat className="h-4 w-4 mr-2" />
                Serienbuchung
                {!bookingRules?.allow_recurring && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Nicht verfügbar
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Single Booking */}
            <TabsContent value="single" className="space-y-6 mt-6">
              {/* Court Selection */}
              <div>
                <Label>Platz</Label>
                <Select
                  value={courtId}
                  onValueChange={(v) => {
                    setCourtId(v);
                    setValidationChecked(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Platz auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setValidationChecked(false);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label>Startzeit</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      setValidationChecked(false);
                    }}
                  />
                </div>
                <div>
                  <Label>Endzeit</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      setValidationChecked(false);
                    }}
                  />
                </div>
              </div>

              {/* Duration Info */}
              {duration > 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    Dauer: {duration} Minuten
                    {bookingRules && (
                      <>
                        {duration < bookingRules.min_booking_duration_minutes && (
                          <span className="text-red-600 ml-2">
                            (Min. {bookingRules.min_booking_duration_minutes} Min.)
                          </span>
                        )}
                        {duration > bookingRules.max_booking_duration_minutes && (
                          <span className="text-red-600 ml-2">
                            (Max. {bookingRules.max_booking_duration_minutes} Min.)
                          </span>
                        )}
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Validation Status */}
              {showValidationStatus && (
                <Alert
                  className={
                    lastValidation.is_valid
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }
                >
                  {lastValidation.is_valid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription
                    className={lastValidation.is_valid ? 'text-green-800' : 'text-red-800'}
                  >
                    {lastValidation.is_valid
                      ? 'Buchung ist verfügbar'
                      : formatValidationError(lastValidation)}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidate}
                  disabled={isValidating || !courtId || !date || !startTime || !endTime}
                  className="flex-1"
                >
                  {isValidating ? 'Prüfe...' : 'Verfügbarkeit prüfen'}
                </Button>
                <Button
                  type="button"
                  onClick={handleCreateBooking}
                  disabled={!lastValidation?.is_valid || isCreating}
                  className="flex-1"
                >
                  {isCreating ? 'Erstelle...' : 'Buchen'}
                </Button>
              </div>
            </TabsContent>

            {/* Series Booking */}
            <TabsContent value="series" className="mt-6">
              <SeriesBookingForm
                clubId={clubId}
                courtId={courtId}
                onSuccess={() => {
                  toast.success('Serienbuchung erfolgreich erstellt');
                  if (onSuccess) onSuccess();
                }}
                onCancel={() => setBookingType('single')}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
