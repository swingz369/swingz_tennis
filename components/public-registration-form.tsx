'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, CheckCircle, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  playingLevel: string;
  previousClub: string;
  motivation: string;
  wantsTrialTraining: boolean;
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  postalCode: '',
  playingLevel: 'intermediate',
  previousClub: '',
  motivation: '',
  wantsTrialTraining: true,
};

const PLAYING_LEVELS = [
  { value: 'beginner', label: 'Anfänger (noch nie gespielt)' },
  { value: 'advanced_beginner', label: 'Fortgeschrittener Anfänger' },
  { value: 'intermediate', label: 'Mittelstufe' },
  { value: 'advanced', label: 'Fortgeschritten' },
  { value: 'tournament', label: 'Turnierspieler' },
];

export default function PublicRegistrationForm({
  clubId,
  clubName,
}: {
  clubId?: string;
  clubName?: string;
}) {
  const [form, setForm] = useState<FormData>(initialFormData);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = 'Vorname erforderlich';
    if (!form.lastName.trim()) errors.lastName = 'Nachname erforderlich';
    if (!form.email.trim()) errors.email = 'E-Mail erforderlich';
    if (!form.email.includes('@')) errors.email = 'Gültige E-Mail erforderlich';
    return errors;
  };

  const validateStep2 = () => {
    const errors: Record<string, string> = {};
    if (!form.street.trim()) errors.street = 'Straße erforderlich';
    if (!form.city.trim()) errors.city = 'Stadt erforderlich';
    if (!form.postalCode.trim()) errors.postalCode = 'PLZ erforderlich';
    return errors;
  };

  const handleNext = () => {
    let errors;
    if (step === 1) errors = validateStep1();
    else if (step === 2) errors = validateStep2();
    if (errors && Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clubId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registrierung fehlgeschlagen');
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
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
            Registrierung eingereicht!
          </h2>
          <p className="text-green-700 dark:text-green-400 max-w-md mx-auto">
            Vielen Dank für deine Anmeldung{clubName ? ` bei ${clubName}` : ''}! Wir prüfen deine
            Unterlagen und melden uns in Kürze per E-Mail bei dir.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-500">
            <Mail className="h-4 w-4" />
            <span>Bestätigung an: {form.email}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-brand-light" />
          {clubName ? `Mitglied werden bei ${clubName}` : 'Mitglied werden'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Schritt {step}/3 —{' '}
          {step === 1
            ? 'Persönliche Daten'
            : step === 2
              ? 'Adresse & Kontakt'
              : 'Tennis & Bestätigung'}
        </p>
        <div className="flex gap-2 mt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-brand-light' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Step 1: Personal Data */}
        {step === 1 && (
          <div className="space-y-4">
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
            <div>
              <Label htmlFor="email">E-Mail *</Label>
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
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="street">Straße & Hausnummer *</Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => updateField('street', e.target.value)}
                placeholder="Musterstraße 1"
                className={fieldErrors.street ? 'border-red-300' : ''}
              />
              {fieldErrors.street && (
                <p className="text-xs text-red-500 mt-1">{fieldErrors.street}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">PLZ *</Label>
                <Input
                  id="postalCode"
                  value={form.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder="12345"
                  className={fieldErrors.postalCode ? 'border-red-300' : ''}
                />
                {fieldErrors.postalCode && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.postalCode}</p>
                )}
              </div>
              <div>
                <Label htmlFor="city">Stadt *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Berlin"
                  className={fieldErrors.city ? 'border-red-300' : ''}
                />
                {fieldErrors.city && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Tennis & Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="playingLevel">Spielstärke</Label>
              <select
                id="playingLevel"
                value={form.playingLevel}
                onChange={(e) => updateField('playingLevel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary bg-background"
              >
                {PLAYING_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="previousClub">Bisheriger Verein</Label>
              <Input
                id="previousClub"
                value={form.previousClub}
                onChange={(e) => updateField('previousClub', e.target.value)}
                placeholder="TC Beispiel e.V. (optional)"
              />
            </div>
            <div>
              <Label htmlFor="motivation">Motivation</Label>
              <Textarea
                id="motivation"
                value={form.motivation}
                onChange={(e) => updateField('motivation', e.target.value)}
                placeholder="Warum möchtest du bei uns Tennis spielen? (optional)"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-light/5 border border-brand-light/20">
              <input
                type="checkbox"
                id="wantsTrialTraining"
                checked={form.wantsTrialTraining}
                onChange={(e) => updateField('wantsTrialTraining', e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="wantsTrialTraining" className="cursor-pointer text-sm">
                Ich möchte ein kostenloses Probetraining vereinbaren
              </Label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Zurück
            </Button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <Button onClick={handleNext} className="gap-2">
              Weiter <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Registrierung absenden
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
