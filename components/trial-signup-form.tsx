'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertCircle, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-fetch';

export default function TrialSignupForm({
  participantId,
  firstName,
  email,
  clubName,
}: {
  participantId: string;
  firstName?: string;
  email?: string;
  clubName?: string;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/public/trial-training/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Anmeldung fehlgeschlagen');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-lg mx-auto border-2 border-success-200 bg-success-50/50">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="h-12 w-12 text-success-500 mx-auto" />
          <h2 className="text-xl font-bold">Willkommen im Verein!</h2>
          <p className="text-sm text-muted-foreground">
            {clubName
              ? `Du bist jetzt offizielles Mitglied bei ${clubName}.`
              : 'Du bist jetzt Mitglied!'}{' '}
            Du kannst dich mit deiner E-Mail-Adresse und deinem Passwort anmelden.
          </p>
          <Button asChild className="gap-2">
            <Link href="/login">Jetzt anmelden</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-xl text-center">Mitglied werden</CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          {clubName ? `Noch ein Schritt — und du bist bei ${clubName} dabei.` : 'Fast geschafft!'}
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{firstName ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{email ?? '—'}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="signup-password">Passwort festlegen *</Label>
            <Input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
              className="mt-1"
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Wird eingerichtet…
              </>
            ) : (
              'Mitgliedschaft abschließen'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
