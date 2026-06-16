'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Trophy,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  Building2,
  User,
  Mail,
  Lock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { apiFetch } from '@/lib/api-fetch';

type Step = 'account' | 'club' | 'success';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Account fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Club fields
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Bitte gib deinen Namen ein.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Bitte gib eine gültige E-Mail ein.');
      return;
    }
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setStep('club');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          club_name: clubName.trim(),
          club_city: clubCity.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registrierung fehlgeschlagen');
      }

      analytics.signUp('register_page', 'default');
      setStep('success');

      // Auto-redirect to onboarding after 2s
      setTimeout(() => {
        router.push('/admin/onboarding');
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* ── Left: Brand Panel ── */}
      <div className="hidden lg:flex lg:flex-1 relative">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 100% at 30% 0%, hsl(var(--brand-primary-light) / 0.3) 0%, transparent 50%),
                radial-gradient(ellipse 80% 80% at 70% 100%, hsl(var(--brand-accent) / 0.18) 0%, transparent 50%),
                linear-gradient(135deg, hsl(150 55% 10%) 0%, hsl(var(--brand-primary)) 50%, hsl(150 30% 8%) 100%)
              `,
            }}
          />
          <div className="absolute inset-0 noise opacity-[0.015]" />
          <div className="absolute top-20 left-20 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
          <div
            className="absolute bottom-20 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora"
            style={{ animationDelay: '5s' }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-16 text-white">
          <div className="absolute top-6 right-6">
            <ThemeToggle className="h-9 w-9 rounded-full text-white/70 hover:text-white hover:bg-background/10" />
          </div>
          <div>
            <Link href="/" className="flex items-center gap-3 mb-12 group">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <span className="text-2xl font-bold font-display">SWINGZ</span>
            </Link>

            <h1 className="text-4xl font-extrabold leading-tight max-w-md">
              Dein Verein.{' '}
              <span className="text-gradient-primary bg-clip-text text-transparent">
                Deine Plattform.
              </span>
            </h1>

            <p className="mt-6 text-white/55 text-lg max-w-md leading-relaxed">
              Registriere deinen Verein in wenigen Minuten und starte mit KI-gestützter
              Trainingsplanung.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: CheckCircle2, text: '14 Tage kostenlos testen' },
              { icon: CheckCircle2, text: 'Keine Kreditkarte erforderlich' },
              { icon: CheckCircle2, text: 'Persönliches Onboarding inklusive' },
              { icon: CheckCircle2, text: 'Daten in der EU gehostet' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/70">
                <item.icon className="h-5 w-5 text-brand-light" />
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Registration Form ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-background dark:bg-card relative">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle className="h-9 w-9 rounded-full" />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />

        <div className="relative w-full max-w-md animate-fade-in-up">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-light to-brand-primary flex items-center justify-center shadow-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-foreground dark:text-white font-display">
                SWINGZ
              </span>
            </Link>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div
              className={`flex items-center gap-2 ${step === 'account' ? 'text-brand-primary' : step === 'club' || step === 'success' ? 'text-brand-light' : 'text-muted-foreground'}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'account' ? 'bg-brand-primary text-white' : 'bg-brand-light text-white'}`}
              >
                {step === 'club' || step === 'success' ? <CheckCircle2 className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm font-medium hidden sm:block">Konto</span>
            </div>
            <div
              className={`h-px w-12 ${step === 'club' || step === 'success' ? 'bg-brand-light' : 'bg-border'}`}
            />
            <div
              className={`flex items-center gap-2 ${step === 'club' ? 'text-brand-primary' : step === 'success' ? 'text-brand-light' : 'text-muted-foreground'}`}
            >
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 'club' ? 'bg-brand-primary text-white' : step === 'success' ? 'bg-brand-light text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {step === 'success' ? <CheckCircle2 className="h-4 w-4" /> : '2'}
              </div>
              <span className="text-sm font-medium hidden sm:block">Verein</span>
            </div>
          </div>

          {step === 'success' ? (
            <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
              <div className="text-center space-y-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-foreground">
                    Willkommen bei SWINGZ!
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Dein Verein <span className="font-semibold text-foreground">{clubName}</span>{' '}
                    wurde erstellt. Wir leiten dich jetzt zum Einrichtungsassistenten weiter.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-brand-light">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Weiterleitung...</span>
                </div>
              </div>
            </Card>
          ) : (
            <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-extrabold text-foreground">
                  {step === 'account' ? 'Konto erstellen' : 'Verein anlegen'}
                </h2>
                <p className="mt-2 text-muted-foreground">
                  {step === 'account'
                    ? 'Erstelle dein persönliches Konto'
                    : 'Gib deinem Verein einen Namen'}
                </p>
              </div>

              {step === 'account' ? (
                <form onSubmit={handleAccountNext} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-semibold text-foreground">
                      Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Max Mustermann"
                        required
                        className="h-12 rounded-xl pl-10"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                      E-Mail
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@verein.de"
                        required
                        className="h-12 rounded-xl pl-10"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                      Passwort
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mindestens 8 Zeichen"
                        required
                        minLength={8}
                        className="h-12 rounded-xl pl-10 pr-12"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                      >
                        {showPassword ? (
                          <Eye className="h-5 w-5" />
                        ) : (
                          <EyeOff className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30 flex items-start gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-green-sm hover:shadow-glow-green transition-all duration-300 hover:brightness-105 active:scale-[0.98]"
                  >
                    Weiter
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="clubName" className="text-sm font-semibold text-foreground">
                      Vereinsname *
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="clubName"
                        type="text"
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        placeholder="TC Beispiel e.V."
                        required
                        className="h-12 rounded-xl pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clubCity" className="text-sm font-semibold text-foreground">
                      Stadt
                    </Label>
                    <Input
                      id="clubCity"
                      type="text"
                      value={clubCity}
                      onChange={(e) => setClubCity(e.target.value)}
                      placeholder="München"
                      className="h-12 rounded-xl"
                    />
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30 flex items-start gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep('account')}
                      className="h-12 rounded-xl flex-1"
                    >
                      Zurück
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-12 rounded-xl flex-1 bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-green-sm hover:shadow-glow-green transition-all duration-300 hover:brightness-105 active:scale-[0.98]"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Wird erstellt...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Verein erstellen
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {step === 'account' && (
                <>
                  <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-background px-4 text-muted-foreground font-medium">
                        oder
                      </span>
                    </div>
                  </div>

                  <div className="text-center text-sm text-muted-foreground">
                    <p>
                      Bereits ein Konto?{' '}
                      <a
                        href="/login"
                        className="text-brand-primary hover:text-brand-light font-semibold transition-colors underline-offset-2 hover:underline"
                      >
                        Anmelden
                      </a>
                    </p>
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Trust badge */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" /> DSGVO-konform · Daten in der EU
            </span>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Mit der Registrierung stimmst du unseren{' '}
            <a
              href="/terms"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Nutzungsbedingungen
            </a>{' '}
            und{' '}
            <a
              href="/privacy"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Datenschutzrichtlinie
            </a>{' '}
            zu.
          </p>
        </div>
      </div>
    </div>
  );
}
