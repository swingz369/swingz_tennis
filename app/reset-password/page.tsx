'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { IconBox } from '@/components/ui/icon-box';
import {
  Trophy,
  KeyRound,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Shield,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/infrastructure/external/supabase/client';

import { createLogger } from '@/lib/logger';

const log = createLogger('reset-password:page');

// ─── State machine ───────────────────────────────────────────────────────────
type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

export default function ResetPasswordPage() {
  const [state, setState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // ── On mount: exchange the recovery code/hash into a session ────────────────
  const exchangeToken = useCallback(async () => {
    const supabase = createClient();

    // Case 1: PKCE flow — Supabase appended ?code=... to the redirectTo URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        log.error('[reset-password] exchangeCodeForSession error:', error.message);
        setErrorMsg('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');
        setState('error');
        return;
      }
      setState('ready');
      // Clean the URL so a refresh doesn't try to re-exchange
      window.history.replaceState({}, '', '/reset-password');
      return;
    }

    // Case 2: Implicit flow — Supabase appended #access_token=... as a hash fragment
    // NOTE: This is a defensive fallback. With PKCE enabled (the default for newer
    // Supabase projects), recovery links use ?code= instead. Kept for backward
    // compatibility with projects that have PKCE disabled.
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          log.error('[reset-password] setSession error:', error.message);
          setErrorMsg('Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.');
          setState('error');
          return;
        }
        setState('ready');
        window.history.replaceState({}, '', '/reset-password');
        return;
      }
    }

    // Case 3: No token at all — check if we already have a valid session
    // (e.g. user navigated here after a previous successful exchange)
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setState('ready');
      return;
    }

    // No token, no session — show error
    setErrorMsg('Kein gültiger Reset-Link gefunden. Bitte fordere einen neuen Link an.');
    setState('error');
  }, []);

  useEffect(() => {
    exchangeToken();
  }, [exchangeToken]);

  // ── Submit new password ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password.length < 8) {
      setValidationError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setState('submitting');

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      log.error('[reset-password] updateUser error:', error.message);
      setValidationError(
        error.message === 'New password should be different from the old password.'
          ? 'Das neue Passwort muss sich vom alten unterscheiden.'
          : 'Fehler beim Setzen des Passworts. Bitte versuche es erneut.'
      );
      setState('ready');
      return;
    }

    // Sign out so the user must log in with the new password.
    // Redirect to /login after a short delay so the user sees the success state.
    await supabase.auth.signOut();
    setState('success');
    setTimeout(() => {
      window.location.href = '/login';
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="relative overflow-hidden bg-brand-secondary">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-auth-hero" />
          <div className="absolute inset-0 opacity-25 overflow-hidden">
            <div className="absolute -top-10 left-10 w-48 h-48 bg-brand-light/15 rounded-full blur-3xl animate-aurora" />
            <div className="absolute -bottom-16 right-20 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl animate-aurora [animation-delay:5s]" />
          </div>
          <div className="absolute inset-0 noise opacity-[0.04]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <nav className="flex h-20 items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-light to-brand-primary rounded-xl blur-lg opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
                <IconBox icon={Trophy} variant="gradient-primary" iconClassName="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold text-white font-display">SWINGZ</span>
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
            <KeyRound className="h-4 w-4" /> Neues Passwort festlegen
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight">
            Passwort zurücksetzen
          </h1>
          <p className="mt-4 text-muted-foreground">
            Wähle ein neues, sicheres Passwort für dein Konto.
          </p>
        </div>
      </section>

      {/* Form / Status */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
          <Card variant="elevated" className="p-6 sm:p-8 border-0 shadow-premium">
            {/* ── Loading ────────────────────────────────────────────────── */}
            {state === 'loading' && (
              <div className="text-center space-y-4 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto" />
                <p className="text-muted-foreground">Link wird verifiziert…</p>
              </div>
            )}

            {/* ── Error (invalid/expired link) ───────────────────────────── */}
            {state === 'error' && (
              <div className="text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-error-50 mx-auto">
                  <AlertCircle className="h-8 w-8 text-error-500" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Link ungültig</h2>
                <p className="text-muted-foreground">{errorMsg}</p>
                <div className="pt-4 flex flex-col gap-2">
                  <Link href="/forgot-password">
                    <Button variant="primary" className="w-full">
                      Neuen Link anfordern
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full">
                      Zurück zum Login
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Success ────────────────────────────────────────────────── */}
            {state === 'success' && (
              <div className="text-center space-y-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-success-50 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success-600" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Passwort erfolgreich geändert
                </h2>
                <p className="text-muted-foreground">
                  Du kannst dich jetzt mit deinem neuen Passwort anmelden.
                </p>
                <div className="pt-4">
                  <Link href="/login">
                    <Button variant="primary" className="w-full">
                      Zum Login
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* ── Ready / Submitting — show the form ─────────────────────── */}
            {(state === 'ready' || state === 'submitting') && (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Neues Passwort</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Gib dein neues Passwort zweimal ein
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                      Neues Passwort
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mindestens 8 Zeichen"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="h-12 rounded-xl pl-10 pr-4"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirm-password"
                      className="text-sm font-semibold text-foreground"
                    >
                      Passwort bestätigen
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Passwort wiederholen"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        className="h-12 rounded-xl pl-10 pr-4"
                      />
                    </div>
                  </div>

                  {validationError && (
                    <div className="rounded-xl bg-error-50 p-4 text-sm text-error-600 border border-error-100 flex items-start gap-3">
                      <Shield className="h-5 w-5 flex-shrink-0 mt-0.5 text-error-400" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-primary to-brand-light text-white font-semibold shadow-glow-primary-sm hover:shadow-glow-primary transition-all duration-300"
                    disabled={state === 'submitting'}
                  >
                    {state === 'submitting' ? 'Wird gespeichert…' : 'Passwort speichern'}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
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
