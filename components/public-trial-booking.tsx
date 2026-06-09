'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  Info,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Anfänger (noch nie gespielt)' },
  { value: 'advanced_beginner', label: 'Fortgeschrittener Anfänger' },
  { value: 'intermediate', label: 'Mittelstufe' },
  { value: 'advanced', label: 'Fortgeschritten' },
  { value: 'tournament', label: 'Turnierspieler' },
];

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  preferredDate: string;
  preferredTime: string;
  experienceLevel: string;
  notes: string;
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  preferredDate: '',
  preferredTime: '',
  experienceLevel: 'intermediate',
  notes: '',
};

export default function PublicTrialBooking({
  clubId,
  clubName,
  clubLogo,
}: {
  clubId?: string;
  clubName?: string;
  clubLogo?: string;
}) {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim() || form.firstName.trim().length < 2)
      errors.firstName = 'Vorname erforderlich (mind. 2 Zeichen)';
    if (!form.lastName.trim() || form.lastName.trim().length < 2)
      errors.lastName = 'Nachname erforderlich (mind. 2 Zeichen)';
    if (!form.email.trim() || !form.email.includes('@'))
      errors.email = 'Gültige E-Mail erforderlich';
    if (!form.phone.trim() || form.phone.trim().length < 5)
      errors.phone = 'Telefonnummer erforderlich';
    if (!form.dateOfBirth) errors.dateOfBirth = 'Geburtsdatum erforderlich';
    if (!form.preferredDate) errors.preferredDate = 'Wunschdatum erforderlich';
    if (!form.preferredTime) errors.preferredTime = 'Uhrzeit erforderlich';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/public/trial-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          dateOfBirth: form.dateOfBirth,
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
          experienceLevel: form.experienceLevel,
          notes: form.notes.trim() || undefined,
          clubId: clubId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Buchung fehlgeschlagen');
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10 max-w-2xl mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          {clubLogo && (
            <div className="flex justify-center">
              <Image
                src={clubLogo}
                alt={clubName || 'Club'}
                width={64}
                height={64}
                className="rounded-full object-cover border-2 border-green-300"
              />
            </div>
          )}
          <div className="flex items-center justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Probetraining angefragt!
          </h2>
          <p className="text-green-700 dark:text-green-400 max-w-md mx-auto">
            Vielen Dank für deine Anfrage{clubName ? ` bei ${clubName}` : ''}! Wir prüfen deinen
            Wunschtermin und melden uns in Kürze per E-Mail mit einer Bestätigung.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-500">
            <Mail className="h-4 w-4" />
            <span>Bestätigung an: {form.email}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSuccess(false);
              setForm(initialFormData);
            }}
            className="mt-4"
          >
            Weitere Anfrage stellen
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        {clubLogo && (
          <div className="flex justify-center mb-2">
            <Image
              src={clubLogo}
              alt={clubName || 'Club'}
              width={56}
              height={56}
              className="rounded-full object-cover border-2 border-brand-light/20 shadow-sm"
            />
          </div>
        )}
        <CardTitle className="text-xl flex items-center gap-2 justify-center">
          <Sparkles className="h-6 w-6 text-brand-light" />
          {clubName ? `Probetraining bei ${clubName}` : 'Kostenloses Probetraining vereinbaren'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Fülle das Formular aus und wir melden uns mit einem Terminvorschlag.
        </p>
      </CardHeader>
      <CardContent>
        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/10 dark:border-blue-800 mb-6">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-medium">So funktioniert&apos;s:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Formular ausfüllen und Wunschtermin angeben</li>
              <li>Wir prüfen die Verfügbarkeit und melden uns per E-Mail</li>
              <li>Kostenloses 60-minütiges Training mit einem unserer Trainer</li>
            </ol>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Persönliche Daten */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="h-4 w-4" /> Persönliche Daten
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Vorname *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  placeholder="Max"
                  className={fieldErrors.firstName ? 'border-red-300' : ''}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Nachname *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  placeholder="Mustermann"
                  className={fieldErrors.lastName ? 'border-red-300' : ''}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> E-Mail *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="max@example.com"
                  className={fieldErrors.email ? 'border-red-300' : ''}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefon *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+49 123 456789"
                  className={fieldErrors.phone ? 'border-red-300' : ''}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="dateOfBirth">Geburtsdatum *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => updateField('dateOfBirth', e.target.value)}
                className={fieldErrors.dateOfBirth ? 'border-red-300' : ''}
              />
              {fieldErrors.dateOfBirth && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>
              )}
            </div>
          </div>

          {/* Wunschtermin */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Wunschtermin
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="preferredDate">Datum *</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => updateField('preferredDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={fieldErrors.preferredDate ? 'border-red-300' : ''}
                />
                {fieldErrors.preferredDate && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.preferredDate}</p>
                )}
              </div>
              <div>
                <Label htmlFor="preferredTime" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Uhrzeit *
                </Label>
                <Input
                  id="preferredTime"
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => updateField('preferredTime', e.target.value)}
                  className={fieldErrors.preferredTime ? 'border-red-300' : ''}
                />
                {fieldErrors.preferredTime && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.preferredTime}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="experienceLevel">Spielstärke</Label>
              <Select
                value={form.experienceLevel}
                onValueChange={(v) => updateField('experienceLevel', v)}
              >
                <SelectTrigger id="experienceLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Anmerkungen</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Besondere Wünsche, Fragen, Einschränkungen... (optional)"
                rows={3}
              />
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Probetraining anfragen
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
