'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export function CourtBookings() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Placeholder data - in real implementation, fetch from API
  const courts = [
    { id: '1', name: 'Platz 1', surface: 'Hard Court', indoor: false },
    { id: '2', name: 'Platz 2', surface: 'Clay Court', indoor: false },
    { id: '3', name: 'Platz 3', surface: 'Hard Court', indoor: true },
    { id: '4', name: 'Platz 4', surface: 'Clay Court', indoor: true },
  ];

  const timeSlots = [
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platzreservierung</CardTitle>
        <CardDescription>Reserviere einen Platz für dein freies Spiel</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">
            {format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="sm" className="ml-auto">
            Datum ändern
          </Button>
        </div>

        {/* Courts Grid */}
        <div className="grid gap-4">
          {courts.map((court) => (
            <div key={court.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#40916C]" />
                    {court.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {court.surface} · {court.indoor ? 'Indoor' : 'Outdoor'}
                  </p>
                </div>
                <Button size="sm">Verfügbarkeit</Button>
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {timeSlots.slice(0, 8).map((time) => {
                  const isBooked = Math.random() > 0.7;
                  return (
                    <Button
                      key={time}
                      variant={isBooked ? 'ghost' : 'outline'}
                      size="sm"
                      disabled={isBooked}
                      className={`text-xs ${isBooked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {time}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Buchungsregeln</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
            <li>• Maximale Buchungsdauer: 90 Minuten</li>
            <li>• Buchungen bis zu 7 Tage im Voraus möglich</li>
            <li>• Kostenlose Stornierung bis 24h vor Beginn</li>
            <li>• Maximal 2 Buchungen pro Tag</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
