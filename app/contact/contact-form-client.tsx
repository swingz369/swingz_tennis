'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';

export function ContactFormClient() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send an email or create a support ticket
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-100 rounded-3xl p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Send className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Nachricht gesendet!</h3>
        <p className="text-gray-600">
          Wir melden uns in Kürze bei dir. In der Regel antworten wir innerhalb von 24 Stunden.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
          Neue Nachricht
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Vorname *</Label>
          <Input
            id="firstName"
            required
            className="h-12 rounded-xl border-gray-200"
            placeholder="Max"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nachname *</Label>
          <Input
            id="lastName"
            required
            className="h-12 rounded-xl border-gray-200"
            placeholder="Mustermann"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail *</Label>
        <Input
          id="email"
          type="email"
          required
          className="h-12 rounded-xl border-gray-200"
          placeholder="max@verein.de"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="club">Vereinsname</Label>
        <Input
          id="club"
          className="h-12 rounded-xl border-gray-200"
          placeholder="z.B. TC Grün-Weiß"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Nachricht *</Label>
        <textarea
          id="message"
          required
          rows={5}
          className="flex w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brandPrimary/20 focus:border-brand-light resize-none"
          placeholder="Beschreibe dein Anliegen..."
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full h-12 rounded-xl bg-gradient-primary text-white shadow-lg"
      >
        <Send className="h-4 w-4 mr-2" />
        Nachricht senden
      </Button>
    </form>
  );
}
