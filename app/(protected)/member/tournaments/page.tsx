'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Calendar, Users, CheckCircle, Clock, Euro } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  format: string;
  category: string;
  surface: string | null;
  max_participants: number;
  registration_deadline: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  prize_info: string | null;
  entry_fee: number;
  participantCount: number;
  myRegistration?: { id: string; status: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  registration: 'Anmeldung offen',
  active: 'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'K.O.-System',
  double_elimination: 'Doppel-K.O.',
  round_robin: 'Jeder gegen jeden',
  swiss: 'Schweizer System',
};

const CATEGORY_LABELS: Record<string, string> = {
  open: 'Offen',
  men: 'Herren',
  women: 'Damen',
  mixed: 'Mixed',
  junior: 'Junioren',
  senior: 'Senioren',
};

export default function MemberTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmTournament, setConfirmTournament] = useState<Tournament | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tournaments');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();

      // Also fetch my registrations
      const regRes = await fetch('/api/tournaments/my-registrations').catch(() => null);
      const regData = regRes?.ok ? await regRes.json() : { registrations: [] };
      const myRegs: Record<string, { id: string; status: string }> = {};
      (regData.registrations ?? []).forEach((r: any) => {
        myRegs[r.tournament_id] = { id: r.id, status: r.status };
      });

      const list: Tournament[] = (data.tournaments ?? []).map((t: any) => ({
        ...t,
        myRegistration: myRegs[t.id] ?? null,
      }));
      setTournaments(list);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleRegister = async () => {
    if (!confirmTournament) return;
    setRegisterLoading(true);
    setRegisterError(null);
    try {
      const res = await fetch(`/api/tournaments/${confirmTournament.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Anmeldung fehlgeschlagen');
      setRegisterSuccess(confirmTournament.name);
      setConfirmTournament(null);
      await fetchTournaments();
    } catch (e: any) {
      setRegisterError(e.message);
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Turniere</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vereinsturniere und Anmeldung</p>
      </div>

      {registerSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 p-4 text-green-700 dark:text-green-300 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Du wurdest für &quot;{registerSuccess}&quot; angemeldet!
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Turniere werden geladen…
        </div>
      ) : error ? (
        <div className="text-center py-10 text-red-500 text-sm">{error}</div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20">
            <Trophy className="h-7 w-7 text-amber-500" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Keine Turniere verfügbar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const isRegistered = !!t.myRegistration && t.myRegistration.status !== 'withdrawn';
            const canRegister =
              t.status === 'registration' &&
              !isRegistered &&
              t.participantCount < t.max_participants;
            const isFull =
              t.status === 'registration' &&
              !isRegistered &&
              t.participantCount >= t.max_participants;

            return (
              <Card key={t.id} className="p-0">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 shrink-0">
                      <Trophy className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <Badge className={`text-[11px] border-0 ${STATUS_COLORS[t.status] ?? ''}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                        {isRegistered && (
                          <Badge className="text-[11px] border-0 bg-brand-light/10 text-brand-light">
                            Angemeldet
                          </Badge>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.start_date).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {t.participantCount}/{t.max_participants}
                        </span>
                        {t.format && <span>{FORMAT_LABELS[t.format] ?? t.format}</span>}
                        {t.category && t.category !== 'open' && (
                          <span>{CATEGORY_LABELS[t.category] ?? t.category}</span>
                        )}
                        {t.entry_fee > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Euro className="h-3 w-3" />
                            {t.entry_fee.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {t.registration_deadline && (
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Anmeldeschluss:{' '}
                          {new Date(t.registration_deadline).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                      {t.prize_info && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          🏆 {t.prize_info}
                        </p>
                      )}
                      <div className="mt-3">
                        {canRegister && (
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-brand-light hover:bg-brand-light/80 text-white"
                            onClick={() => {
                              setConfirmTournament(t);
                              setRegisterError(null);
                            }}
                          >
                            Anmelden
                          </Button>
                        )}
                        {isFull && (
                          <span className="text-xs text-red-500 font-medium">Ausgebucht</span>
                        )}
                        {isRegistered && (
                          <span className="text-xs text-brand-light font-medium flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Angemeldet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirm registration dialog */}
      <Dialog open={!!confirmTournament} onOpenChange={() => setConfirmTournament(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Für Turnier anmelden
            </DialogTitle>
          </DialogHeader>
          {confirmTournament && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 p-4 space-y-2">
                <p className="font-semibold text-sm">{confirmTournament.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(confirmTournament.start_date).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </div>
                {confirmTournament.entry_fee > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Euro className="h-4 w-4" />
                    Startgebühr: {confirmTournament.entry_fee.toFixed(2)} €
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Durch die Anmeldung bestätigst du deine Teilnahme an diesem Turnier.
              </p>
              {registerError && <p className="text-xs text-red-500">{registerError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmTournament(null)}
              disabled={registerLoading}
            >
              Abbrechen
            </Button>
            <Button
              className="bg-brand-light hover:bg-brand-light/80 text-white"
              onClick={handleRegister}
              disabled={registerLoading}
            >
              {registerLoading ? 'Anmelden…' : 'Jetzt anmelden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
