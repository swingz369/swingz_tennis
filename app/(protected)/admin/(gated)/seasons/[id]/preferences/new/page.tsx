'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { WeeklyAvailability, TimeSlot } from '@/lib/types/season-planning';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

interface PreferenceFormPageProps {
  params: {
    id: string; // season_id
  };
}

export default function PreferenceFormPage({ params }: PreferenceFormPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    user_role: 'member' as 'member' | 'trainer',
    preferred_level: 'intermediate' as string,
    preferred_age_group: 'adult' as string,
    weekly_availability: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    } as WeeklyAvailability,
    special_requests: '',
    priority: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiFetch(`/api/seasons/${params.id}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }

      toast.success('Präferenzen erfolgreich gespeichert');
      router.push(`/admin/seasons/${params.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  const addTimeSlot = (day: keyof WeeklyAvailability) => {
    setFormData((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: [...prev.weekly_availability[day], { start: '09:00', end: '12:00' } as TimeSlot],
      },
    }));
  };

  const removeTimeSlot = (day: keyof WeeklyAvailability, index: number) => {
    setFormData((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: prev.weekly_availability[day].filter((_, i) => i !== index),
      },
    }));
  };

  const updateTimeSlot = (
    day: keyof WeeklyAvailability,
    index: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      weekly_availability: {
        ...prev.weekly_availability,
        [day]: prev.weekly_availability[day].map((slot, i) =>
          i === index ? { ...slot, [field]: value } : slot
        ),
      },
    }));
  };

  const days = [
    { key: 'monday', label: 'Montag' },
    { key: 'tuesday', label: 'Dienstag' },
    { key: 'wednesday', label: 'Mittwoch' },
    { key: 'thursday', label: 'Donnerstag' },
    { key: 'friday', label: 'Freitag' },
    { key: 'saturday', label: 'Samstag' },
    { key: 'sunday', label: 'Sonntag' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/admin/seasons/${params.id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Verfügbarkeit angeben"
          description="Geben Sie Ihre wöchentliche Verfügbarkeit für diese Saison an"
        />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Grundinformationen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="preferred_level">Bevorzugtes Level</Label>
                  <Select
                    value={formData.preferred_level}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, preferred_level: value }))
                    }
                  >
                    <SelectTrigger id="preferred_level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Anfänger</SelectItem>
                      <SelectItem value="intermediate">Fortgeschritten</SelectItem>
                      <SelectItem value="advanced">Profi</SelectItem>
                      <SelectItem value="professional">Wettkampf</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferred_age_group">Altersgruppe</Label>
                  <Select
                    value={formData.preferred_age_group}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, preferred_age_group: value }))
                    }
                  >
                    <SelectTrigger id="preferred_age_group">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youth">Jugend</SelectItem>
                      <SelectItem value="adult">Erwachsene</SelectItem>
                      <SelectItem value="senior">Senioren</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priorität (1-10)</Label>
                  <Select
                    value={formData.priority.toString()}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, priority: parseInt(value) }))
                    }
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                        <SelectItem key={p} value={p.toString()}>
                          {p} {p >= 8 ? '(Hoch)' : p <= 3 ? '(Niedrig)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Availability */}
          <Card>
            <CardHeader>
              <CardTitle>Wöchentliche Verfügbarkeit</CardTitle>
              <CardDescription>
                Wählen Sie die Zeitfenster, in denen Sie trainieren können
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {days.map((day) => (
                <div key={day.key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">{day.label}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTimeSlot(day.key)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Zeitslot hinzufügen
                    </Button>
                  </div>

                  {formData.weekly_availability[day.key].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Keine Verfügbarkeit an diesem Tag
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {formData.weekly_availability[day.key].map((slot, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) =>
                              updateTimeSlot(day.key, index, 'start', e.target.value)
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <span className="text-muted-foreground">bis</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateTimeSlot(day.key, index, 'end', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTimeSlot(day.key, index)}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Special Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Besondere Wünsche</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="z.B. Bevorzuge Outdoor-Plätze, Training mit bestimmten Trainern, etc."
                rows={4}
                value={formData.special_requests}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, special_requests: e.target.value }))
                }
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/seasons/${params.id}`)}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Save className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Präferenzen speichern
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
