// lib/schemas/booking.schema.ts
// KEIN 'use server' — dieses Schema wird sowohl Client- als auch Server-seitig genutzt

import { z } from 'zod';

/** Booking creation schema — shared between client (react-hook-form) and server (action validation) */
export const createBookingSchema = z
  .object({
    courtId: z.string().uuid('Ungültige Court-ID'),
    startTime: z.string().datetime('Ungültige Startzeit'),
    endTime: z.string().datetime('Ungültige Endzeit'),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.endTime) > new Date(data.startTime), {
    message: 'Endzeit muss nach Startzeit liegen',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      const duration = new Date(data.endTime).getTime() - new Date(data.startTime).getTime();
      return duration <= 3 * 60 * 60 * 1000; // Max 3 Stunden
    },
    { message: 'Maximale Buchungsdauer ist 3 Stunden', path: ['endTime'] }
  )
  .refine((data) => new Date(data.startTime) > new Date(), {
    message: 'Buchungen können nicht in der Vergangenheit liegen',
    path: ['startTime'],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
