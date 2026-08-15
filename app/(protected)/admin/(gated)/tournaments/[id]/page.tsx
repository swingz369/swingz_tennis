'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle,
  Edit3,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  STATUS_LABELS,
  STATUS_VARIANTS as SHARED_STATUS_VARIANTS,
  FORMAT_LABELS,
  CATEGORY_LABELS,
  REGISTRATION_STATUS_LABELS,
  REGISTRATION_STATUS_VARIANTS,
  PAYMENT_STATUS_LABELS,
} from '@/src/constants/tournaments';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { apiFetch } from '@/lib/api-fetch';

// ── Types ──────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  name: string;
  description?: string | null;
  format?: string | null;
  category?: string | null;
  surface?: string | null;
  max_participants?: number | null;
  registration_deadline?: string | null;
  start_date: string;
  end_date?: string | null;
  status?: string | null;
  prize_info?: string | null;
  entry_fee?: number | null;
  organizer_id?: string | null;
  created_at?: string | null;
  club_id: string;
}

interface RegistrationUser {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Registration {
  id: string;
  tournament_id: string;
  user_id: string;
  status: string | null;
  payment_status: string | null;
  registration_date: string | null;
  notes: string | null;
  seed: number | null;
  users: RegistrationUser | null;
}

interface TournamentDetail {
  tournament: Tournament;
  registrations: Registration[];
  participantCount: number;
}

// ── Labels & Helpers ───────────────────────────────────────────────────

// Constants imported from @/src/constants/tournaments

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Page Component ─────────────────────────────────────────────────────

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const tournament = data?.tournament ?? null;
  const registrations = data?.registrations ?? [];

  const fetchTournament = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/tournaments/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Turnier nicht gefunden');
        throw new Error('Fehler beim Laden');
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTournament();
  }, [fetchTournament]);

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const res = await apiFetch(`/api/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Fehler beim Aktualisieren');
      await fetchTournament();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await apiFetch(`/api/tournaments/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      router.push('/admin/tournaments');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Error ──

  if (error || !tournament) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" asChild className="p-1 h-auto">
          <Link href="/admin/tournaments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold">Turnier nicht gefunden</h2>
            <p className="text-sm text-muted-foreground">
              {error || 'Das Turnier existiert nicht.'}
            </p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/admin/tournaments">Zur Turnier-Übersicht</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ──

  const registeredCount = registrations.filter(
    (r) => r.status === 'registered' || r.status === 'confirmed'
  ).length;
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length;
  const capacityPercent =
    tournament.max_participants && tournament.max_participants > 0
      ? Math.round((registeredCount / tournament.max_participants) * 100)
      : 0;

  return (
    <div className="space-y-6 animate-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" asChild className="p-1 h-auto mt-1">
            <Link href="/admin/tournaments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-primary">{tournament.name}</h1>
              <Badge variant={SHARED_STATUS_VARIANTS[tournament.status ?? 'draft'] ?? 'secondary'}>
                {STATUS_LABELS[tournament.status ?? 'draft'] ?? tournament.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Erstellt am {formatDateTime(tournament.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select
              value={tournament.status ?? 'draft'}
              onValueChange={handleStatusChange}
              disabled={statusUpdating}
            >
              <SelectTrigger className="w-40 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="registration">Anmeldung offen</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="cancelled">Abgesagt</SelectItem>
              </SelectContent>
            </Select>
            {statusUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Löschen
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Turnier löschen"
        description="Möchten Sie dieses Turnier wirklich löschen?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={handleDelete}
      />

      {/* ── Stats Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teilnehmer</p>
              <p className="text-xl font-bold">
                {registeredCount}
                {tournament.max_participants && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {' '}
                    / {tournament.max_participants}
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-success-100 dark:bg-success-900/20 shrink-0">
              <CheckCircle className="h-5 w-5 text-success-700 dark:text-success-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bestätigt</p>
              <p className="text-xl font-bold">{confirmedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-warning-100 dark:bg-warning-900/20 shrink-0">
              <Calendar className="h-5 w-5 text-warning-700 dark:text-warning-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="text-sm font-semibold">{formatDate(tournament.start_date)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-info-100 dark:bg-info-900/20 shrink-0">
              <Clock className="h-5 w-5 text-info-700 dark:text-info-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auslastung</p>
              <p className="text-xl font-bold">
                {tournament.max_participants ? `${capacityPercent}%` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Content Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Tournament Info ── */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="px-5 pt-5 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning-500" />
                Turnier-Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <p className="text-xs text-muted-foreground">Format</p>
                  <p className="font-medium">
                    {FORMAT_LABELS[tournament.format ?? ''] ?? tournament.format ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Kategorie</p>
                  <p className="font-medium capitalize">
                    {CATEGORY_LABELS[tournament.category ?? ''] ?? tournament.category ?? '—'}
                  </p>
                </div>
                {tournament.surface && (
                  <div>
                    <p className="text-xs text-muted-foreground">Belag</p>
                    <p className="font-medium">{tournament.surface}</p>
                  </div>
                )}
                {tournament.entry_fee != null && tournament.entry_fee > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Startgebühr</p>
                    <p className="font-medium">€{tournament.entry_fee.toFixed(2)}</p>
                  </div>
                )}
              </div>

              <hr className="border-border dark:border-white/10" />

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {formatDate(tournament.start_date)}
                    {tournament.end_date && ` – ${formatDate(tournament.end_date)}`}
                  </span>
                </div>
                {tournament.registration_deadline && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Anmeldefrist: {formatDate(tournament.registration_deadline)}</span>
                  </div>
                )}
                {tournament.max_participants && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Kapazität: {tournament.max_participants} Teilnehmer
                      {registeredCount > 0 && ` (${registeredCount} angemeldet)`}
                    </span>
                  </div>
                )}
              </div>

              {tournament.description && (
                <>
                  <hr className="border-border dark:border-white/10" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Beschreibung</p>
                    <p className="text-sm text-foreground dark:text-foreground">
                      {tournament.description}
                    </p>
                  </div>
                </>
              )}

              {tournament.prize_info && (
                <>
                  <hr className="border-border dark:border-white/10" />
                  <div className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                    <p className="text-sm">{tournament.prize_info}</p>
                  </div>
                </>
              )}

              {/* Capacity Bar */}
              {tournament.max_participants && tournament.max_participants > 0 && (
                <>
                  <hr className="border-border dark:border-white/10" />
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Kapazität</span>
                      <span className="font-medium">{capacityPercent}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted dark:bg-card/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          capacityPercent >= 90
                            ? 'bg-error-500'
                            : capacityPercent >= 60
                              ? 'bg-warning-500'
                              : 'bg-success-500'
                        }`}
                        style={{ width: `${capacityPercent}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Participants ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Teilnehmer ({registrations.length})
              </CardTitle>
              {tournament.status === 'registration' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/tournaments/${id}/register`)}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Verwalten
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {registrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Noch keine Anmeldungen</p>
                  <p className="text-xs text-muted-foreground">
                    Sobald sich Mitglieder anmelden, werden sie hier angezeigt.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {registrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted dark:bg-card/5 border border-border dark:border-white/10 hover:border-brand-light/30 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                        {(reg.users?.full_name ?? '??')
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {reg.users?.full_name || 'Unbekannt'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {reg.users?.email || ''}
                        </p>
                      </div>

                      {/* Seed */}
                      {reg.seed != null && (
                        <Badge variant="secondary" size="sm" className="shrink-0">
                          #{reg.seed}
                        </Badge>
                      )}

                      {/* Payment Status */}
                      {reg.payment_status && reg.payment_status !== 'pending' && (
                        <Badge
                          variant={
                            reg.payment_status === 'paid'
                              ? 'success'
                              : reg.payment_status === 'refunded'
                                ? 'secondary'
                                : 'error'
                          }
                          size="sm"
                          className="shrink-0"
                        >
                          {PAYMENT_STATUS_LABELS[reg.payment_status] ?? reg.payment_status}
                        </Badge>
                      )}

                      {/* Registration Status */}
                      <Badge
                        variant={
                          REGISTRATION_STATUS_VARIANTS[reg.status ?? 'registered'] ?? 'default'
                        }
                        size="sm"
                        className="shrink-0"
                      >
                        {REGISTRATION_STATUS_LABELS[reg.status ?? 'registered'] ?? reg.status}
                      </Badge>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                        {formatDate(reg.registration_date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
