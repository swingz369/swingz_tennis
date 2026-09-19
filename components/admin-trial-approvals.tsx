'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Loader2,
  Sparkles,
  Clock,
  Calendar,
  XCircle,
  ChevronDown,
  AlertCircle,
  UserPlus,
  Bell,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { useUserClub } from '@/hooks/use-user-data';
import { PageHeader } from '@/components/ui/page-header';
interface TrialParticipant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}

interface TrialTrainingItem {
  id: string;
  participant: TrialParticipant;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  trainer: { id: string; name: string };
  court: { id: string; name: string };
  status: string;
  notes?: string;
  createdAt: string;
  clubId?: string;
  feedback?: { rating: number; comments: string; wouldRecommend: boolean };
}

interface TrainerOption {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CourtOption {
  id: string;
  name: string;
  surface: string;
}

export default function AdminTrialApprovals() {
  const { data: clubData } = useUserClub();
  const adminClubId = clubData?.clubId ?? null;

  const [requests, setRequests] = useState<TrialTrainingItem[]>([]);
  const [trainers, setTrainers] = useState<TrainerOption[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    'requested' | 'scheduled' | 'cancelled' | 'completed' | 'no_show' | 'all'
  >('requested');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Approve dialog state
  const [approveId, setApproveId] = useState<string | null>(null);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [selectedCourtId, setSelectedCourtId] = useState('');

  // Convert-to-member dialog state
  const [convertId, setConvertId] = useState<string | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertedIds, setConvertedIds] = useState<Set<string>>(new Set());
  const [reminderSending, setReminderSending] = useState<string | null>(null);
  const [reminderSentIds, setReminderSentIds] = useState<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url =
        filter === 'all' ? '/api/trial-trainings' : `/api/trial-trainings?status=${filter}`;
      const res = await apiFetch(url, { credentials: 'include' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? 'Fehler beim Laden der Probetrainings');
      }
      const data = await res.json();
      setRequests(data.trialTrainings || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchTrainers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/trainer-profiles', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setTrainers(
        (data.profiles || []).filter(
          (p: TrainerOption & { status?: string }) => p.status !== 'inactive'
        )
      );
    } catch {
      // silently fail
    }
  }, []);

  const fetchCourts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/courts', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCourts(
        Array.isArray(data)
          ? data.filter((c: CourtOption & { isActive?: boolean }) => c.isActive !== false)
          : []
      );
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    fetchTrainers();
    fetchCourts();
  }, [fetchRequests, fetchTrainers, fetchCourts]);

  const handleApprove = async () => {
    if (!approveId || !selectedTrainerId || !selectedCourtId) return;
    setProcessing(true);
    try {
      const trainer = trainers.find(
        (t) => t.id === selectedTrainerId || t.userId === selectedTrainerId
      );
      const court = courts.find((c) => c.id === selectedCourtId);
      const res = await apiFetch(`/api/trial-trainings/${approveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'scheduled',
          trainerId: selectedTrainerId,
          trainerName: trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Trainer',
          courtId: selectedCourtId,
          courtName: court?.name || 'Platz',
        }),
      });
      if (!res.ok) throw new Error('Genehmigung fehlgeschlagen');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === approveId
            ? {
                ...r,
                status: 'scheduled',
                trainer: {
                  id: selectedTrainerId,
                  name: trainer ? `${trainer.firstName} ${trainer.lastName}` : 'Trainer',
                },
                court: {
                  id: selectedCourtId,
                  name: court?.name || 'Platz',
                },
              }
            : r
        )
      );
      setApproveId(null);
      setSelectedTrainerId('');
      setSelectedCourtId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) return;
    setProcessing(true);
    try {
      const res = await apiFetch(`/api/trial-trainings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'cancelled',
          notes: `Abgelehnt: ${rejectionReason.trim()}`,
        }),
      });
      if (!res.ok) throw new Error('Ablehnung fehlgeschlagen');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'cancelled', notes: `Abgelehnt: ${rejectionReason.trim()}` }
            : r
        )
      );
      setSelectedId(null);
      setRejectionReason('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setProcessing(false);
    }
  };

  const handleSendReminder = async (id: string) => {
    setReminderSending(id);
    try {
      const res = await apiFetch(`/api/trial-trainings/${id}/reminder`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erinnerung konnte nicht gesendet werden');
      setReminderSentIds((prev) => new Set(prev).add(id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setReminderSending(null);
    }
  };

  const handleStatusChange = async (id: string, status: 'completed' | 'no_show') => {
    setProcessing(true);
    try {
      const res = await apiFetch(`/api/trial-trainings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Status konnte nicht geändert werden');
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setProcessing(false);
    }
  };

  const handleConvertToMember = async () => {
    if (!convertId || !adminClubId) return;
    const trial = requests.find((r) => r.id === convertId);
    if (!trial) return;

    setConvertLoading(true);
    setConvertError(null);
    try {
      const res = await apiFetch(`/api/admin/trial-training/${convertId}/convert-to-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: trial.participant.email,
          fullName: `${trial.participant.firstName} ${trial.participant.lastName}`,
          clubId: adminClubId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Konvertierung fehlgeschlagen');
      setConvertedIds((prev) => new Set(prev).add(convertId));
      setConvertId(null);
    } catch (err: unknown) {
      setConvertError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setConvertLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getAge = (dob: string) => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return (
          <Badge className="bg-warning-100 text-warning-700 border-warning-200">Angefragt</Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-success-100 text-success-700 border-success-200">Geplant</Badge>
        );
      case 'cancelled':
        return <Badge className="bg-error-100 text-error-700 border-error-200">Abgelehnt</Badge>;
      case 'completed':
        return <Badge className="bg-info-100 text-info-700 border-info-200">Abgeschlossen</Badge>;
      case 'no_show':
        return (
          <Badge className="bg-error-100 text-error-700 border-error-200">Nicht erschienen</Badge>
        );
      case 'converted':
        return (
          <Badge className="bg-success-100 text-success-700 border-success-200">
            Mitglied geworden
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filtered = requests;
  const requestedCount = requests.filter((r) => r.status === 'requested').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Probetraining-Genehmigungen"
        description={`${requestedCount} ausstehende${requestedCount !== 1 ? '' : 's'} von ${requests.length} Probetrainings`}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['requested', 'Angefragt'],
            ['scheduled', 'Geplant'],
            ['completed', 'Abgeschlossen'],
            ['no_show', 'Nicht erschienen'],
            ['cancelled', 'Abgelehnt'],
            ['all', 'Alle'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
            {key === 'requested' && requestedCount > 0 && (
              <span className="ml-1.5 bg-background/20 text-2xs px-1.5 py-0 rounded-full">
                {requestedCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50 dark:text-muted-foreground" />
            Keine Probetrainings in dieser Kategorie
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className={
                r.status === 'requested'
                  ? 'border-warning-200 bg-warning-50/30'
                  : r.status === 'cancelled'
                    ? 'border-error-100 bg-error-50/20'
                    : ''
              }
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-lg text-primary">
                        {r.participant.firstName} {r.participant.lastName}
                      </span>
                      {statusBadge(r.status)}
                      {r.status === 'requested' && (
                        <Badge variant="outline" className="text-xs bg-brand-light/10">
                          <Sparkles className="h-3 w-3 mr-1" /> Neu
                        </Badge>
                      )}
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{r.participant.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" /> {r.participant.phone}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {formatDate(r.scheduledDate)} um {r.scheduledTime} Uhr
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        {getAge(r.participant.dateOfBirth)} Jahre &middot; {r.duration} Min.
                      </div>
                    </div>

                    {/* Trainer/Court info */}
                    {r.status !== 'requested' && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Trainer:</span> {r.trainer.name}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {r.court.name}
                        </span>
                      </div>
                    )}

                    {/* Notes */}
                    {r.notes && (
                      <p className="text-sm text-muted-foreground bg-muted dark:bg-card/5 p-2 rounded border border-border dark:border-white/5">
                        {r.notes}
                      </p>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Erstellt: {formatDateTime(r.createdAt)}
                    </div>

                    {/* Actions */}
                    {r.status === 'requested' && (
                      <div className="flex items-center gap-2 pt-2">
                        {selectedId === r.id ? (
                          <>
                            <div className="flex-1 flex items-center gap-2">
                              <Textarea
                                placeholder="Ablehnungsgrund... (z.B. keine Kapazität, Termin nicht möglich)"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="h-9 text-sm flex-1 min-w-0"
                                rows={1}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(r.id)}
                                disabled={processing || !rejectionReason.trim()}
                                className="gap-1"
                              >
                                <XCircle className="h-4 w-4" /> Ablehnen
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedId(null);
                                setRejectionReason('');
                              }}
                            >
                              Abbrechen
                            </Button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setApproveId(r.id)}
                              className="gap-1"
                            >
                              <CheckCircle className="h-4 w-4" /> Annehmen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedId(r.id)}
                              className="gap-1"
                            >
                              <XCircle className="h-4 w-4" /> Ablehnen
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Abgeschlossen/Nicht erschienen + Zu Mitglied konvertieren */}
                    {(r.status === 'scheduled' || r.status === 'completed') && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {r.status === 'scheduled' &&
                          (reminderSentIds.has(r.id) ? (
                            <Badge className="bg-success-100 text-success-700 border-success-200 gap-1">
                              <CheckCircle className="h-3 w-3" /> Erinnerung gesendet
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reminderSending === r.id}
                              onClick={() => handleSendReminder(r.id)}
                              className="gap-1"
                            >
                              {reminderSending === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Bell className="h-4 w-4" />
                              )}
                              Erinnerung senden
                            </Button>
                          ))}
                        {r.status === 'scheduled' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processing}
                              onClick={() => handleStatusChange(r.id, 'completed')}
                              className="gap-1"
                            >
                              <CheckCircle className="h-4 w-4" /> Abgeschlossen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processing}
                              onClick={() => handleStatusChange(r.id, 'no_show')}
                              className="gap-1"
                            >
                              <XCircle className="h-4 w-4" /> Nicht erschienen
                            </Button>
                          </>
                        )}
                        {convertedIds.has(r.id) ? (
                          <Badge className="bg-success-100 text-success-700 border-success-200 gap-1">
                            <CheckCircle className="h-3 w-3" /> Konvertiert
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setConvertId(r.id);
                              setConvertError(null);
                            }}
                            className="gap-1 text-brand-light border-brand-light/30 hover:bg-brand-light/10"
                          >
                            <UserPlus className="h-4 w-4" /> Zu Mitglied konvertieren
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Feedback des Interessenten */}
                    {r.feedback && (
                      <div className="mt-2 p-3 rounded-xl bg-muted/40 border border-border text-sm space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">Feedback</span>
                          <span
                            className="text-warning-500 tracking-tight"
                            aria-label={`${r.feedback.rating} von 5 Sternen`}
                          >
                            {'★'.repeat(Math.min(Math.max(r.feedback.rating, 0), 5))}
                            <span className="text-muted-foreground/40">
                              {'★'.repeat(
                                Math.max(5 - Math.min(Math.max(r.feedback.rating, 0), 5), 0)
                              )}
                            </span>
                          </span>
                          {r.feedback.wouldRecommend && (
                            <Badge variant="outline" className="text-xs">
                              Würde weiterempfehlen
                            </Badge>
                          )}
                        </div>
                        {r.feedback.comments && (
                          <p className="text-muted-foreground text-xs">{r.feedback.comments}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog (inline modal) */}
      {approveId &&
        (() => {
          const trial = requests.find((r) => r.id === approveId);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-background dark:bg-card rounded-xl shadow-lg border border-border dark:border-white/10 w-full max-w-lg mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">Probetraining bestätigen</h2>
                    {trial && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {trial.participant.firstName} {trial.participant.lastName} &middot;{' '}
                        {formatDate(trial.scheduledDate)} um {trial.scheduledTime} Uhr
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setApproveId(null);
                      setSelectedTrainerId('');
                      setSelectedCourtId('');
                    }}
                  >
                    ✕
                  </Button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  {/* Trainer select */}
                  <div>
                    <label
                      htmlFor="trainer-select"
                      className="block text-sm font-medium text-foreground dark:text-foreground mb-2"
                    >
                      Trainer zuweisen
                    </label>
                    {trainers.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-warning-50 border border-warning-200 text-warning-700 text-sm">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Keine Trainer verfügbar. Bitte zuerst Trainer im System anlegen.
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="trainer-select"
                          value={selectedTrainerId}
                          onChange={(e) => setSelectedTrainerId(e.target.value)}
                          className="w-full appearance-none bg-background dark:bg-muted border border-border dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground dark:text-white pr-10 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent transition-all"
                        >
                          <option value="">Trainer auswählen...</option>
                          {trainers.map((t) => (
                            <option key={t.id} value={t.userId || t.id}>
                              {t.firstName} {t.lastName}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    )}
                  </div>

                  {/* Court select */}
                  <div>
                    <label
                      htmlFor="court-select"
                      className="block text-sm font-medium text-foreground dark:text-foreground mb-2"
                    >
                      Platz zuweisen
                    </label>
                    {courts.length === 0 ? (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-warning-50 border border-warning-200 text-warning-700 text-sm">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Keine Plätze verfügbar. Bitte zuerst Plätze im System anlegen.
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          id="court-select"
                          value={selectedCourtId}
                          onChange={(e) => setSelectedCourtId(e.target.value)}
                          className="w-full appearance-none bg-background dark:bg-muted border border-border dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground dark:text-white pr-10 focus:outline-none focus:ring-2 focus:ring-brand-light focus:border-transparent transition-all"
                        >
                          <option value="">Platz auswählen...</option>
                          {courts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.surface})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border dark:border-white/5 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setApproveId(null);
                      setSelectedTrainerId('');
                      setSelectedCourtId('');
                    }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedTrainerId || !selectedCourtId || processing}
                    onClick={handleApprove}
                    className="gap-1"
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Bestätigen &amp; Einplanen
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Konvertieren-Dialog */}
      {convertId &&
        (() => {
          const trial = requests.find((r) => r.id === convertId);
          if (!trial) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-background dark:bg-card rounded-xl shadow-lg border border-border dark:border-white/10 w-full max-w-md mx-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-border dark:border-white/5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-primary">Zu Mitglied konvertieren</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Erstellt einen Vereins-Account und Mitgliedschaft
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConvertId(null);
                      setConvertError(null);
                    }}
                  >
                    ✕
                  </Button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div className="rounded-xl bg-brand-light/5 border border-brand-light/10 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-brand-light" />
                      <span className="text-sm font-medium">
                        {trial.participant.firstName} {trial.participant.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {trial.participant.email}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Ein Supabase-Account wird angelegt (falls noch nicht vorhanden) und die Person
                    wird als <strong>Mitglied</strong> im aktuellen Verein eingetragen. Die
                    Zugangsdaten werden per E-Mail versandt.
                  </p>

                  {convertError && (
                    <div className="p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {convertError}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-border dark:border-white/5 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConvertId(null);
                      setConvertError(null);
                    }}
                    disabled={convertLoading}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConvertToMember}
                    disabled={convertLoading || !adminClubId}
                    className="gap-1"
                  >
                    {convertLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Mitgliedschaft anlegen
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
