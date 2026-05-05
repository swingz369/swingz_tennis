'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, User, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/empty-state';

export function MyBookings() {
  // Placeholder data - in real implementation, fetch from API
  const myBookings = [
    {
      id: '1',
      type: 'session',
      title: 'Gruppen-Training Fortgeschritten',
      date: new Date(2026, 4, 7),
      startTime: '18:00',
      endTime: '19:30',
      location: 'Platz 3',
      trainer: 'Thomas Müller',
      status: 'confirmed',
    },
    {
      id: '2',
      type: 'court',
      title: 'Platz 1 - Freies Spiel',
      date: new Date(2026, 4, 8),
      startTime: '14:00',
      endTime: '15:00',
      location: 'Platz 1',
      status: 'pending',
    },
    {
      id: '3',
      type: 'session',
      title: 'Einzel-Training',
      date: new Date(2026, 4, 9),
      startTime: '17:00',
      endTime: '18:00',
      location: 'Platz 2',
      trainer: 'Sarah Schmidt',
      status: 'confirmed',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500">Bestätigt</Badge>;
      case 'pending':
        return (
          <Badge variant="outline" className="border-yellow-500 text-yellow-700">
            Ausstehend
          </Badge>
        );
      case 'cancelled':
        return <Badge variant="error">Storniert</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (myBookings.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Calendar}
            title="Keine Buchungen"
            description="Du hast noch keine aktiven Buchungen. Buche ein Training oder einen Platz, um loszulegen."
            action={{
              label: 'Jetzt buchen',
              onClick: () => {
                // Navigate to bookings tab
                window.location.href = '/bookings-unified';
              },
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meine Buchungen</CardTitle>
        <CardDescription>Übersicht über alle deine aktiven Buchungen</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {myBookings.map((booking) => (
            <div
              key={booking.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {/* Title and Status */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{booking.title}</h3>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(booking.date, 'EEEE, d. MMMM', { locale: de })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {booking.startTime} - {booking.endTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{booking.location}</span>
                    </div>
                    {booking.trainer && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{booking.trainer}</span>
                      </div>
                    )}
                  </div>

                  {/* Type Badge */}
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {booking.type === 'session' ? 'Training' : 'Platzreservierung'}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm">
                    Details
                  </Button>
                  {booking.status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Stornieren
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gesamt</span>
            <span className="font-medium">{myBookings.length} aktive Buchungen</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
