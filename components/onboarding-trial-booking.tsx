'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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

interface ClubOption {
  id: string;
  name: string;
}

interface OnboardingTrialBookingProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  clubs?: ClubOption[];
  clubId?: string;
  clubName?: string;
}

export default function OnboardingTrialBooking({
  firstName,
  lastName,
  email,
  phone,
  clubs,
  clubId: initialClubId,
  clubName,
}: OnboardingTrialBookingProps) {
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('intermediate');
  const [notes, setNotes] = useState('');
  const [phoneValue, setPhoneValue] = useState(phone || '');
  const [selectedClubId, setSelectedClubId] = useState(initialClubId || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fetchedClubs, setFetchedClubs] = useState<ClubOption[]>([]);

  // Fetch clubs from public API if none were provided via SSR props
  useEffect(() => {
    if (clubs && clubs.length > 0) return;
    let cancelled = false;
    apiFetch('/api/public/clubs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.clubs?.length) {
          setFetchedClubs(data.clubs);
          // Auto-select if only one club
          if (data.clubs.length === 1 && !initialClubId) {
            setSelectedClubId(data.clubs[0].id);
          }
        }
      })
      .catch(() => {}); // non-fatal
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allClubs = clubs && clubs.length > 0 ? clubs : fetchedClubs;

  const resolvedClubName = clubName || allClubs.find((c) => c.id === selectedClubId)?.name;
  const needsPhone = !phone || phone.length < 5;
  const needsClubSelect = allClubs.length > 1 && !initialClubId;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!dateOfBirth) errors.dateOfBirth = 'Geburtsdatum erforderlich';
    if (!preferredDate) errors.preferredDate = 'Wunschdatum erforderlich';
    if (!preferredTime) errors.preferredTime = 'Uhrzeit erforderlich';
    if (needsPhone && (!phoneValue || phoneValue.trim().length < 5)) {
      errors.phone = 'Telefonnummer erforderlich';
    }
    if (needsClubSelect && !selectedClubId) {
      errors.club = 'Bitte wähle einen Verein';
    }
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
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone: phoneValue.trim(),
          dateOfBirth,
          preferredDate,
          preferredTime,
          experienceLevel,
          notes: notes.trim() || undefined,
          clubId: selectedClubId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Buchung fehlgeschlagen');

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex items-center justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">
            Probetraining angefragt!
          </h2>
          <p className="text-green-700 dark:text-green-400 max-w-md mx-auto">
            Vielen Dank{resolvedClubName ? ` für dein Interesse an ${resolvedClubName}` : ''}! Wir
            prüfen deinen Wunschtermin und melden uns in Kürze per E-Mail.
          </p>
          <p className="text-sm text-green-600 dark:text-green-500">
            Nach deinem Probetraining wirst du automatisch als Mitglied hinzugefügt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/10 dark:border-blue-800">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-medium">So funktioniert&apos;s:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Wähle deinen Wunschtermin für ein kostenloses Probetraining</li>
              <li>Wir prüfen die Verfügbarkeit und bestätigen per E-Mail</li>
              <li>Nach dem Probetraining wirst du automatisch als Mitglied hinzugefügt</li>
            </ol>
          </div>
        </div>

        {/* Pre-filled info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-primary to-brand-light flex items-center justify-center text-white font-bold text-sm">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {firstName} {lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Club selector — only shown when multiple clubs exist */}
          {needsClubSelect && (
            <div>
              <Label htmlFor="club">Verein *</Label>
              <Select
                value={selectedClubId}
                onValueChange={(v) => {
                  setSelectedClubId(v);
                  setFieldErrors((prev) => ({ ...prev, club: '' }));
                }}
              >
                <SelectTrigger id="club" className={fieldErrors.club ? 'border-red-300' : ''}>
                  <SelectValue placeholder="Verein auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {allClubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.club && <p className="text-xs text-red-500 mt-1">{fieldErrors.club}</p>}
            </div>
          )}

          {/* Phone — only shown when user profile has no phone */}
          {needsPhone && (
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefonnummer *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phoneValue}
                onChange={(e) => {
                  setPhoneValue(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, phone: '' }));
                }}
                placeholder="+49 123 456789"
                className={fieldErrors.phone ? 'border-red-300' : ''}
              />
              {fieldErrors.phone && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="dateOfBirth">Geburtsdatum *</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                setFieldErrors((prev) => ({ ...prev, dateOfBirth: '' }));
              }}
              className={fieldErrors.dateOfBirth ? 'border-red-300' : ''}
            />
            {fieldErrors.dateOfBirth && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="preferredDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Wunschdatum *
              </Label>
              <Input
                id="preferredDate"
                type="date"
                value={preferredDate}
                onChange={(e) => {
                  setPreferredDate(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, preferredDate: '' }));
                }}
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
                value={preferredTime}
                onChange={(e) => {
                  setPreferredTime(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, preferredTime: '' }));
                }}
                className={fieldErrors.preferredTime ? 'border-red-300' : ''}
              />
              {fieldErrors.preferredTime && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.preferredTime}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="experienceLevel">Spielstärke</Label>
            <Select value={experienceLevel} onValueChange={setExperienceLevel}>
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Besondere Wünsche, Fragen, Einschränkungen... (optional)"
              rows={2}
            />
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
