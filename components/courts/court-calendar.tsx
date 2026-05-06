'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, Users } from 'lucide-react';
import { addDays, startOfWeek, endOfWeek, format, isSameDay, isToday } from 'date-fns';
import { de } from 'date-fns/locale';

interface Court {
  id: string;
  name: string;
  number: number;
  court_type: {
    name: string;
    surface_type: string;
    hourly_rate: number;
  };
  status: string;
}

interface Booking {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: string;
  booking_type: string;
  number_of_players: number;
  user: {
    id: string;
    email: string;
    user_metadata: {
      full_name?: string;
    };
  };
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  booking?: Booking;
}

interface DaySchedule {
  date: string;
  day_of_week: number;
  time_slots: TimeSlot[];
}

interface CourtSchedule {
  court_id: string;
  court_name: string;
  court_type: {
    name: string;
    surface_type: string;
    hourly_rate: number;
  };
  days: DaySchedule[];
}

const TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
];

export default function CourtCalendar() {
  const [currentWeek, setCurrentWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [courts, setCourts] = useState<Court[]>([]);
  const [schedules, setSchedules] = useState<Record<string, CourtSchedule>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: string; time: string } | null>(
    null
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    if (courts.length > 0) {
      fetchSchedules();
    }
  }, [courts, currentWeek]);

  const fetchCourts = async () => {
    try {
      const response = await fetch('/api/courts');
      if (response.ok) {
        const data = await response.json();
        setCourts(data);
        if (data.length > 0) {
          setSelectedCourt(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch courts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    const startDate = format(currentWeek, 'yyyy-MM-dd');
    const endDate = format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const newSchedules: Record<string, CourtSchedule> = {};

    for (const court of courts) {
      try {
        const response = await fetch(
          `/api/courts/${court.id}/schedule?start_date=${startDate}&end_date=${endDate}`
        );
        if (response.ok) {
          const data = await response.json();
          newSchedules[court.id] = data;
        }
      } catch (error) {
        console.error(`Failed to fetch schedule for court ${court.id}:`, error);
      }
    }

    setSchedules(newSchedules);
  };

  const handlePreviousWeek = () => {
    setCurrentWeek(addDays(currentWeek, -7));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addDays(currentWeek, 7));
  };

  const handleToday = () => {
    setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleTimeSlotClick = (date: string, time: string, isAvailable: boolean) => {
    if (isAvailable) {
      setSelectedTimeSlot({ date, time });
    }
  };

  const getBookingColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getSurfaceTypeLabel = (surfaceType: string) => {
    switch (surfaceType) {
      case 'clay':
        return 'Sand';
      case 'hard':
        return 'Hartplatz';
      case 'grass':
        return 'Rasen';
      case 'carpet':
        return 'Teppich';
      case 'artificial_grass':
        return 'Kunstrasen';
      default:
        return surfaceType;
    }
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold text-brand-primary">
                Platz-Kalender
              </CardTitle>
              <p className="text-gray-500">Wochenansicht der Tennisplatz-Buchungen</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleToday}>
                <Calendar className="h-4 w-4 mr-2" />
                Heute
              </Button>
              <Button variant="outline" onClick={handleNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {courts.map((court) => (
                <Button
                  key={court.id}
                  variant={selectedCourt === court.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCourt(court.id)}
                  className="whitespace-nowrap"
                >
                  {court.name}
                </Button>
              ))}
            </div>

            {selectedCourt && schedules[selectedCourt] && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-200 p-2 text-left bg-gray-50">Zeit</th>
                      {weekDays.map((day) => (
                        <th
                          key={day.toISOString()}
                          className={`border border-gray-200 p-2 text-center bg-gray-50 min-w-[120px] ${
                            isToday(day) ? 'bg-brand-primary text-white' : ''
                          }`}
                        >
                          <div className="font-medium">{format(day, 'EEE', { locale: de })}</div>
                          <div className="text-sm opacity-75">{format(day, 'dd.MM.')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((time) => (
                      <tr key={time}>
                        <td className="border border-gray-200 p-2 text-center bg-gray-50 font-medium">
                          {time}
                        </td>
                        {weekDays.map((day) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const daySchedule = schedules[selectedCourt]?.days.find(
                            (d) => d.date === dateStr
                          );
                          const timeSlot = daySchedule?.time_slots.find(
                            (slot) => slot.start_time === time
                          );

                          if (!timeSlot) {
                            return (
                              <td
                                key={day.toISOString()}
                                className="border border-gray-200 p-2 text-center bg-gray-100"
                              >
                                -
                              </td>
                            );
                          }

                          const isAvailable = timeSlot.is_available;
                          const booking = timeSlot.booking;

                          return (
                            <td
                              key={day.toISOString()}
                              className={`border border-gray-200 p-1 cursor-pointer transition-colors ${
                                isAvailable ? 'hover:bg-green-50' : 'bg-gray-50'
                              }`}
                              onClick={() => handleTimeSlotClick(dateStr, time, isAvailable)}
                            >
                              {isAvailable ? (
                                <div className="h-8 w-full rounded bg-green-100 border border-green-300 flex items-center justify-center">
                                  <span className="text-green-700 text-xs">Verfügbar</span>
                                </div>
                              ) : booking ? (
                                <div
                                  className={`h-8 w-full rounded border p-1 ${getBookingColor(
                                    booking.status
                                  )}`}
                                >
                                  <div className="text-xs font-medium truncate">
                                    {booking.user.user_metadata?.full_name ||
                                      booking.user.email.split('@')[0]}
                                  </div>
                                  <div className="text-xs opacity-75">
                                    {booking.number_of_players} Pers.
                                  </div>
                                </div>
                              ) : (
                                <div className="h-8 w-full rounded bg-gray-200 border border-gray-300 flex items-center justify-center">
                                  <span className="text-gray-500 text-xs">-</span>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedCourt && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Platz-Informationen</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>{' '}
                    {courts.find((c) => c.id === selectedCourt)?.name}
                  </div>
                  <div>
                    <span className="text-gray-600">Typ:</span>{' '}
                    {getSurfaceTypeLabel(
                      courts.find((c) => c.id === selectedCourt)?.court_type?.surface_type || ''
                    )}
                  </div>
                  <div>
                    <span className="text-gray-600">Stundensatz:</span>{' '}
                    {courts.find((c) => c.id === selectedCourt)?.court_type?.hourly_rate || 0} €/h
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>{' '}
                    <Badge
                      variant={
                        courts.find((c) => c.id === selectedCourt)?.status === 'available'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {courts.find((c) => c.id === selectedCourt)?.status === 'available'
                        ? 'Verfügbar'
                        : 'Nicht verfügbar'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedTimeSlot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Neue Buchung erstellen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">
                  <strong>Datum:</strong>{' '}
                  {format(new Date(selectedTimeSlot.date), 'EEEE, dd.MM.yyyy', { locale: de })}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Zeit:</strong> {selectedTimeSlot.time} - {selectedTimeSlot.time}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setSelectedTimeSlot(null)}>Abbrechen</Button>
                <Button>Buchung bestätigen</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
