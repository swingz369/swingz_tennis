'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Trophy, Mail, CheckCircle2, Shield } from 'lucide-react';
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
        throw new Error(extractErrorMessage(data) || 'Anfrage fehlgeschlagen');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex relative overflow-hidden">
      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-auth-hero" />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-16 text-white">
          <div className="absolute top-6 right-6">
            <ThemeToggle className="h-9 w-9 rounded-full text-white/70 hover:text-white hover:bg-background/10" />
          </div>
          <div className="flex items-center gap-3 mb-12 group">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <span className="text-2xl font-bold font-display">SWINGZ</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-tight max-w-md">
            Kein Problem. <span className="text-brand-light">Wir helfen dir.</span>
          </h1>

          <p className="mt-6 text-white/55 text-lg max-w-md leading-relaxed">
            Gib deine E-Mail-Adresse ein und wir senden dir einen sicheren Link zum Zurücksetzen
            deines Passworts.
          </p>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background dark:bg-card relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle className="h-9 w-9 rounded-full" />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />

        <div className="relative w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-foreground dark:text-white font-display">
                SWINGZ
              </span>
            </div>
          </div>

          <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
            {submitted ? (
              <div className="text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success-50 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">E-Mail versendet</h2>
                <p className="text-muted-foreground">
                  Falls ein Konto mit <strong>{email}</strong> existiert, haben wir dir gerade einen
                  Link zum Zurücksetzen des Passworts gesendet. Bitte prüfe auch deinen Spam-Ordner.
                </p>
                <p className="text-sm text-muted-foreground">Der Link ist 60 Minuten gültig.</p>
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
                    <div className="rounded-xl bg-error-50 p-4 text-sm text-error-600 border border-error-100 flex items-start gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-error-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-primary-sm hover:shadow-glow-primary transition-all duration-300"
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

          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> DSGVO-konform · Daten in der EU
            </span>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Deine Daten werden gemäß unserer{' '}
            <Link href="/datenschutz" className="hover:underline">
              Datenschutzerklärung
            </Link>{' '}
            verarbeitet.
          </p>
        </div>
      </div>
    </div>
  );
}
