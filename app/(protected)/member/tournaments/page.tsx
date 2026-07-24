'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Calendar, Users, CheckCircle, Clock, Euro } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  FORMAT_LABELS,
  CATEGORY_LABELS,
} from '@/src/constants/tournaments';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

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
      const res = await apiFetch('/api/tournaments');
      if (res.status === 403) {
        setTournaments([]);
        return;
      }
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();

      // Also fetch my registrations
      const regRes = await apiFetch('/api/tournaments/my-registrations').catch(() => null);
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
      const res = await apiFetch(`/api/tournaments/${confirmTournament.id}/register`, {
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
      <PageHeader title="Turniere" description="Vereinsturniere und Anmeldung" />

      {registerSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-success-50 dark:bg-success-900/20 p-4 text-success-700 dark:text-success-300 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Du wurdest für &quot;{registerSuccess}&quot; angemeldet!
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Turniere werden geladen…
        </div>
      ) : error ? (
        <div className="text-center py-10 text-error-500 text-sm">{error}</div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <IconBox icon={Trophy} size="lg" variant="amber" className="h-16 w-16" />
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
                    <IconBox icon={Trophy} size="md" variant="amber" className="h-11 w-11" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{t.name}</p>
                        <Badge className={`text-2xs border-0 ${STATUS_COLORS[t.status] ?? ''}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </Badge>
                        {isRegistered && (
                          <Badge className="text-2xs border-0 bg-brand-light/10 text-brand-light">
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
                        <p className="text-2xs text-muted-foreground mt-1 flex items-center gap-1">
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
                        <p className="text-2xs text-muted-foreground mt-0.5">🏆 {t.prize_info}</p>
                      )}
                      <div className="mt-3">
                        {canRegister && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="h-8 text-xs"
                            onClick={() => {
                              setConfirmTournament(t);
                              setRegisterError(null);
                            }}
                          >
                            Anmelden
                          </Button>
                        )}
                        {isFull && (
                          <span className="text-xs text-error-500 font-medium">Ausgebucht</span>
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
      <ConfirmDialog
        open={!!confirmTournament}
        onOpenChange={() => setConfirmTournament(null)}
        title={
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning-500" />
            Für Turnier anmelden
          </span>
        }
        confirmLabel={registerLoading ? 'Anmelden…' : 'Jetzt anmelden'}
        variant="primary"
        loading={registerLoading}
        onConfirm={handleRegister}
      >
        {confirmTournament && (
          <div className="space-y-3 py-2">
            <div className="rounded-xl bg-warning-50 dark:bg-warning-900/10 p-4 space-y-2">
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
            {registerError && <p className="text-xs text-error-500">{registerError}</p>}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
