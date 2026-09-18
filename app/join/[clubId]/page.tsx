'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

export default function JoinPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [clubName, setClubName] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    apiFetch(`/api/public/club/${clubId}`)
      .then((r) => r.json())
      .then((d) => (d.club ? setClubName(d.club.name) : setNotFound(true)))
      .catch(() => setNotFound(true));
  }, [clubId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/join', {
        method: 'POST',
        body: JSON.stringify({ email, password, fullName, clubId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(extractErrorMessage(data) ?? 'Fehler');
        return;
      }
      setSuccessMsg(data.message);
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (notFound)
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4">
          <p className="font-semibold">Verein nicht gefunden</p>
          <p className="text-sm text-muted-foreground">
            Dieser Link ist ungültig oder der Verein ist nicht aktiv.
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Zum Login
          </Link>
        </Card>
      </div>
    );

  if (success)
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
        <Card className="p-8 max-w-sm w-full text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/20 mx-auto">
            <Trophy className="h-6 w-6 text-success-600" />
          </div>
          <p className="font-semibold">Registrierung eingegangen!</p>
          <p className="text-sm text-muted-foreground">{successMsg}</p>
        </Card>
      </div>
    );

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mx-auto">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{clubName ? `${clubName} beitreten` : '…'}</h1>
          <p className="text-sm text-muted-foreground">
            {clubName ? `Registriere dich als Mitglied bei ${clubName}` : 'Lade Vereinsdaten...'}
          </p>
        </div>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Max Mustermann"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="max@beispiel.de"
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
                className="mt-1.5"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !clubName}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Registrierung absenden
            </Button>
          </form>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Bereits Mitglied?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Einloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
