'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Trophy, KeyRound, Mail, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Anfrage fehlgeschlagen');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-brand-secondary">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">SWINGZ</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-white/90 hover:text-white hover:bg-background/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück zum Login
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-muted py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
            <KeyRound className="h-4 w-4" /> Passwort zurücksetzen
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Passwort vergessen?
          </h1>
          <p className="mt-4 text-muted-foreground">
            Kein Problem. Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum
            Zurücksetzen deines Passworts.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
          <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-50 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">E-Mail versendet</h2>
                <p className="text-muted-foreground">
                  Falls ein Konto mit <strong>{email}</strong> existiert, haben wir dir gerade einen
                  Link zum Zurücksetzen des Passworts gesendet. Bitte prüfe auch deinen Spam-Ordner.
                </p>
                <p className="text-xs text-muted-foreground">Der Link ist 60 Minuten gültig.</p>
                <div className="pt-4 flex flex-col gap-2">
                  <Link href="/login">
                    <Button variant="primary" className="w-full">
                      Zurück zum Login
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSubmitted(false);
                      setEmail('');
                    }}
                    className="w-full"
                  >
                    Andere E-Mail-Adresse versuchen
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Passwort zurücksetzen</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Wir senden dir einen sicheren Link per E-Mail
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                      E-Mail-Adresse
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@verein.de"
                        required
                        autoComplete="email"
                        className="h-12 rounded-xl pl-10 pr-4"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-start gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-green-sm hover:shadow-glow-green transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? 'Sende…' : 'Reset-Link anfordern'}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Du erinnerst dich wieder?{' '}
                    <Link
                      href="/login"
                      className="text-brand-primary hover:text-brand-light font-semibold transition-colors underline-offset-2 hover:underline"
                    >
                      Zurück zum Login
                    </Link>
                  </p>
                </form>
              </>
            )}
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Shield className="inline h-3.5 w-3.5 mr-1" />
            Deine Daten werden gemäß unserer{' '}
            <Link href="/datenschutz" className="hover:underline">
              Datenschutzerklärung
            </Link>{' '}
            verarbeitet.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-secondary py-8 border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-4">
            <Link href="/about" className="hover:text-white transition-colors">
              Über uns
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Kontakt
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Nutzungsbedingungen
            </Link>
            <Link href="/datenschutz" className="hover:text-white transition-colors">
              Datenschutz
            </Link>
          </div>
          <p>© 2026 SWINGZ – Premium Tennis Club Management</p>
        </div>
      </footer>
    </div>
  );
}
