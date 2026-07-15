'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

export function ContactFormClient() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const firstName = (formData.get('firstName') as string)?.trim();
    const lastName = (formData.get('lastName') as string)?.trim();
    const email = (formData.get('email') as string)?.trim();
    const clubName = (formData.get('club') as string)?.trim();
    const message = (formData.get('message') as string)?.trim();

    try {
      const res = await apiFetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, clubName, message }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Senden fehlgeschlagen');
      }

      setSubmitted(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-700/30 rounded-3xl p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-success-600 dark:text-success-400" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Nachricht gesendet!</h3>
        <p className="text-muted-foreground">
          Danke für dein Interesse! Wir melden uns persönlich bei dir — in der Regel innerhalb von
          24 Stunden.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
          Weitere Anfrage stellen
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} id="contact-form" className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname *</Label>
          <Input
            id="firstName"
            name="firstName"
            required
            className="h-12 rounded-xl border-border"
            placeholder="Max"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname *</Label>
          <Input
            id="lastName"
            name="lastName"
            required
            className="h-12 rounded-xl border-border"
            placeholder="Mustermann"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          className="h-12 rounded-xl border-border"
          placeholder="max@verein.de"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="club">Vereinsname</Label>
        <Input
          id="club"
          name="club"
          className="h-12 rounded-xl border-border"
          placeholder="z.B. TC Grün-Weiß"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Nachricht *</Label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="flex w-full rounded-xl border border-border bg-background px-4 py-3 text-base shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-light resize-none"
          placeholder="Erzähl uns von deinem Verein und was dich an SWINGZ interessiert..."
        />
      </div>

      {error && (
        <div className="rounded-lg bg-error-50 dark:bg-error-900/10 border border-error-200 dark:border-error-700/30 px-4 py-3 text-sm text-error-700 dark:text-error-400">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 rounded-xl bg-gradient-primary text-white shadow-lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Wird gesendet...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Nachricht senden
          </>
        )}
      </Button>
    </form>
  );
}
