// components/bookings/CreateBookingForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  createBookingSchema,
  createBookingAction,
  type CreateBookingInput,
} from '@/lib/actions/booking.actions';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Court {
  id: string;
  name: string;
}

interface CreateBookingFormProps {
  courts: Court[];
}

export function CreateBookingForm({ courts }: CreateBookingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema), // Client-seitige Validierung
    defaultValues: {
      courtId: '',
      startTime: '',
      endTime: '',
      notes: '',
    },
  });

  function onSubmit(values: CreateBookingInput) {
    startTransition(async () => {
      const result = await createBookingAction(values);

      if (!result.success) {
        // Server-seitige Fehler in Formular anzeigen
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof CreateBookingInput, {
              message: errors[0],
            });
          });
        } else {
          toast.error(result.error);
        }
        return;
      }

      toast.success('Buchung erfolgreich erstellt!');
      form.reset();
      router.push('/dashboard/bookings');
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Court Auswahl */}
        <FormField
          control={form.control}
          name="courtId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Platz</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Platz auswählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Startzeit */}
        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Startzeit</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Endzeit */}
        <FormField
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endzeit</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notizen */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notizen (optional)</FormLabel>
              <FormControl>
                <Input placeholder="z.B. Training mit Gruppe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? 'Buchung wird erstellt...' : 'Jetzt buchen'}
        </Button>
      </form>
    </Form>
  );
}
