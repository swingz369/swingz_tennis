'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { generateAIAnalysis } from '@/lib/season-planning/ai-analysis';
import {
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Info,
  Loader2,
  ClipboardCheck,
  Users,
  Calendar,
  Clock,
  Bell,
  FileText,
  Sparkles,
  Star,
  XCircle,
  ChevronRight,
  RefreshCw,
  Brain,
  Euro,
  Receipt,
  TrendingUp,
  DollarSign,
  Table2,
} from 'lucide-react';
import type { ConflictDetectionResult, ConflictSeverityLevel } from '@/lib/season-planning/types';
import type { SeasonBillingPreview } from '@/lib/billing/season-billing.service';
import { apiFetch } from '@/lib/api-fetch';

export function FinalizeStep() {
  const { state, confirmPlan, detectConflicts } = useWizard();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
  const [hasRunCheck, setHasRunCheck] = useState(false);

  // Reset hasRunCheck when the plan changes (user went back to step 2)
  useEffect(() => {
    setHasRunCheck(false);
  }, [state.clusteringResult]);
  const [confirmedWarnings, setConfirmedWarnings] = useState<Set<string>>(new Set());
  const [adminNotes, setAdminNotes] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [aiReviewText, setAiReviewText] = useState<string | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [hasRunAiReview, setHasRunAiReview] = useState(false);

  // Billing preview state
  const [billingPreview, setBillingPreview] = useState<SeasonBillingPreview | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingFetched, setBillingFetched] = useState(false);

  const conflicts = state.conflicts;
  const criticalConflicts = conflicts.filter(
    (c) => c.severity === 'critical' && c.status === 'open'
  );
  const warningConflicts = conflicts.filter(
    (c) => c.severity === 'warning' || c.severity === 'info'
  );
  const hasBlockingConflicts = criticalConflicts.length > 0;
  const allWarningsAccepted =
    warningConflicts.length === 0 || warningConflicts.every((c) => confirmedWarnings.has(c.id));
  const resolvedCount = conflicts.filter((c) => c.status === 'resolved').length;

  const handleRunConflicts = useCallback(async () => {
    setIsLoading(true);
    setHasRunCheck(true);
    try {
      await detectConflicts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server-Fehler bei der Konfliktprüfung';
      toast.error('Konfliktprüfung fehlgeschlagen', {
        description: message,
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [detectConflicts]);

  const handleResolve = async (conflictId: string) => {
    setResolvingId(conflictId);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/conflicts`, {
        method: 'PATCH',
        body: JSON.stringify({ conflictId, action: 'resolve', notes: 'Manuell gelöst' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server-Fehler (${res.status})`);
      }
      // Optimistic update handled by re-fetch
      await detectConflicts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Lösen';
      toast.error('Konflikt konnte nicht gelöst werden', {
        description: message,
        duration: 6000,
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleIgnore = async (conflictId: string) => {
    setResolvingId(conflictId);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/planning/conflicts`, {
        method: 'PATCH',
        body: JSON.stringify({ conflictId, action: 'ignore', notes: 'Bewusst ignoriert' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server-Fehler (${res.status})`);
      }
      await detectConflicts();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Ignorieren';
      toast.error('Konflikt konnte nicht ignoriert werden', {
        description: message,
        duration: 6000,
      });
    } finally {
      setResolvingId(null);
    }
  };

  // AI Review: analyzes the plan + conflicts and gives a human-readable summary
  const handleAiReview = useCallback(async () => {
    setAiReviewLoading(true);
    setHasRunAiReview(true);
    try {
      const groups = state.clusteringResult?.groups || [];
      const planSlots = groups.map((g) => ({
        id: g.groupId,
        groupName: g.groupName,
        groupColor: '#6366F1',
        trainerId: g.trainerId,
        trainerName: g.trainerName,
        dayOfWeek: g.dayOfWeek as number,
        startTime: g.startTime,
        endTime: g.endTime,
        durationMin: 90,
        courtId: g.courtId,
        courtName: g.courtName,
        memberIds: g.memberIds,
        memberNames: g.memberDetails.map((d) => d.memberName),
      }));

      const text = await generateAIAnalysis({
        plan: planSlots,
        totalMembers: state.selectedMemberIds.length,
        totalMembersPlanned: state.clusteringResult?.metrics.totalMembers || 0,
        membersMultipleGroups: 0,
        membersNotPlanned:
          state.clusteringResult?.unassignedMembers.map((m) => ({
            name: m.memberName,
          })) || [],
        seasonStart: '',
        seasonEnd: '',
        activeWeeks: 1,
        useAI: true,
      });
      setAiReviewText(text);
    } catch {
      setAiReviewText('KI-Review momentan nicht verfügbar.');
    } finally {
      setAiReviewLoading(false);
    }
  }, [state.clusteringResult, state.selectedMemberIds]);

  const handleConfirm = useCallback(async () => {
    if (hasBlockingConflicts || !allWarningsAccepted) return;
    setIsConfirming(true);
    try {
      await confirmPlan();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server-Fehler bei der Bestätigung';
      toast.error('Bestätigung fehlgeschlagen', {
        description: message,
        duration: 8000,
      });
    } finally {
      setIsConfirming(false);
    }
  }, [hasBlockingConflicts, allWarningsAccepted, confirmPlan]);

  const toggleWarning = (conflictId: string) => {
    setConfirmedWarnings((prev) => {
      const next = new Set(prev);
      if (next.has(conflictId)) next.delete(conflictId);
      else next.add(conflictId);
      return next;
    });
  };

  // Fetch billing preview when confirmed and not yet fetched
  useEffect(() => {
    if (state.isConfirmed && !billingFetched) {
      setBillingFetched(true);
      setBillingLoading(true);
      setBillingError(null);
      apiFetch(`/api/seasons/${state.seasonId}/billing`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          setBillingPreview(data);
        })
        .catch((err) => {
          setBillingError(err instanceof Error ? err.message : 'Vorschau nicht verfügbar');
        })
        .finally(() => setBillingLoading(false));
    }
  }, [state.isConfirmed, billingFetched, state.seasonId]);

  const handleGenerateInvoices = async () => {
    setIsGeneratingInvoices(true);
    try {
      const res = await apiFetch(`/api/seasons/${state.seasonId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        const created = data.created?.length ?? 0;
        const skipped = data.skipped?.length ?? 0;
        toast.success(
          `${created} Rechnung(en) erstellt${skipped > 0 ? `, ${skipped} bereits vorhanden` : ''}`
        );
      } else {
        toast.error(data.error ?? 'Fehler beim Erstellen der Rechnungen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  // === POST-CONFIRMATION SUCCESS STATE ===
  if (state.isConfirmed) {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-800">Planung erfolgreich bestätigt!</h2>
            <p className="text-sm text-green-700 mt-2 max-w-md mx-auto">
              Trainingsgruppen und Sessions wurden erstellt und in die Profile der Trainer und
              Mitglieder übertragen. Alle Beteiligten werden automatisch benachrichtigt.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <p className="text-sm text-muted-foreground">Gruppen erstellt</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {state.clusteringResult?.groups.length || 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">Sessions</p>
              </div>
              <p className="text-2xl font-bold mt-1">{state.publishedSessionIds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">Benachrichtigungen</p>
              </div>
              <p className="text-2xl font-bold mt-1">{state.selectedMemberIds.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Waitlist */}
        {(state.clusteringResult?.waitlistSummary.length || 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Wartelisten-Benachrichtigungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.clusteringResult?.waitlistSummary.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{w.memberName}</span>
                    <span>
                      Warteliste {w.groupName} (Pos. {w.position})
                    </span>
                    {w.alternativeGroupName && (
                      <Badge variant="outline" className="text-xs">
                        Alternativ: {w.alternativeGroupName}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ BILLING PREVIEW ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-brand-primary" />
                  Abrechnungs-Vorschau
                </CardTitle>
                <CardDescription>
                  Kostenzusammensetzung basierend auf der Saisonplanung
                </CardDescription>
              </div>
              {billingPreview && (
                <Badge variant="outline" className="text-xs">
                  {billingPreview.memberCount} Mitglieder · {billingPreview.groupCount} Gruppen
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* ── Loading State ── */}
            {billingLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                <p className="text-sm text-muted-foreground">Berechne Abrechnungs-Vorschau...</p>
              </div>
            )}

            {/* ── Error State ── */}
            {!billingLoading && billingError && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <p className="text-sm text-muted-foreground">{billingError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBillingFetched(false);
                    setBillingError(null);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Erneut versuchen
                </Button>
              </div>
            )}

            {/* ── Empty State ── */}
            {!billingLoading &&
              !billingError &&
              billingPreview &&
              billingPreview.memberPreviews.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Info className="h-8 w-8 text-blue-400" />
                  <p className="text-sm text-muted-foreground">
                    Keine Planungseinträge für die Abrechnung gefunden.
                  </p>
                </div>
              )}

            {/* ── Billing Content ── */}
            {!billingLoading &&
              !billingError &&
              billingPreview &&
              billingPreview.memberPreviews.length > 0 && (
                <div className="space-y-6">
                  {/* ▸ Summary KPI Cards */}
                  <div className="grid gap-3 md:grid-cols-4">
                    <BillingKpiCard
                      icon={<Euro className="h-4 w-4 text-brand-primary" />}
                      label="Trainingskosten"
                      value={billingPreview.totalTrainingCost}
                      subtitle={`${billingPreview.groupCount} Gruppen`}
                    />
                    <BillingKpiCard
                      icon={<Users className="h-4 w-4 text-blue-500" />}
                      label="Mitgliedsbeiträge"
                      value={billingPreview.totalMembershipFees}
                      subtitle={`${billingPreview.memberCount} Mitglieder`}
                    />
                    <BillingKpiCard
                      icon={<DollarSign className="h-4 w-4 text-amber-500" />}
                      label="Zusatzgebühren"
                      value={billingPreview.totalAdditionalFees}
                      subtitle={billingPreview.totalAdditionalFees > 0 ? 'Konfiguriert' : 'Keine'}
                    />
                    <BillingKpiCard
                      icon={<TrendingUp className="h-4 w-4 text-green-600" />}
                      label="Gesamtsumme"
                      value={billingPreview.grandTotal}
                      subtitle="Alle Posten"
                      highlight
                    />
                  </div>

                  {/* ▸ Config Info */}
                  {billingPreview.config && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      <span className="font-medium text-foreground">Konfiguration:</span>
                      <Badge variant="secondary" className="text-[11px]">
                        Stundensatz {billingPreview.config.trainer_hourly_rate.toFixed(2)} €
                      </Badge>
                      {billingPreview.config.use_trainer_profile_rate && (
                        <Badge variant="secondary" className="text-[11px]">
                          Trainer-Profile
                        </Badge>
                      )}
                      {billingPreview.config.include_membership_fee && (
                        <Badge variant="secondary" className="text-[11px]">
                          Mitgliedsbeitrag inkl.
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[11px]">
                        MwSt. {billingPreview.config.tax_rate}%
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        Zahlungsziel {billingPreview.config.payment_terms_days} Tage
                      </Badge>
                    </div>
                  )}

                  {/* ▸ Group Breakdown Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Table2 className="h-4 w-4 text-muted-foreground" />
                      Kostenzusammensetzung pro Gruppe
                    </h4>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Gruppe / Trainer
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                              Stundensatz
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                              Dauer
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                              Termine
                            </th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                              Teilnehmer
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Gesamtkosten
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Pro Person
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingPreview.groupBreakdown.map((group, idx) => (
                            <tr
                              key={`${group.groupName}-${idx}`}
                              className={`border-b border-border last:border-0 ${
                                idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                              } hover:bg-muted/30 transition-colors`}
                            >
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-foreground">{group.groupName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {group.trainerName}
                                </div>
                              </td>
                              <td className="text-center px-3 py-2.5 tabular-nums">
                                {group.trainerHourlyRate.toFixed(2)} €
                              </td>
                              <td className="text-center px-3 py-2.5 tabular-nums">
                                {group.sessionDurationHours.toFixed(1)} h
                              </td>
                              <td className="text-center px-3 py-2.5 tabular-nums">
                                {group.totalSessions}
                              </td>
                              <td className="text-center px-3 py-2.5 tabular-nums">
                                {group.participantCount}
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums font-medium">
                                {group.totalTrainerCost.toFixed(2)} €
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums font-medium text-brand-primary">
                                {group.costPerParticipant.toFixed(2)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ▸ Member Cost Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Kosten pro Mitglied
                      <Badge variant="secondary" className="text-[11px] ml-1">
                        {billingPreview.memberPreviews.length}
                      </Badge>
                    </h4>
                    <div className="rounded-lg border border-border overflow-hidden max-h-[420px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/50 z-10">
                          <tr className="border-b border-border">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Mitglied
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Gruppe
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Training
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Beitrag
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Zusatz
                            </th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                              Gesamt
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingPreview.memberPreviews.map((member, idx) => (
                            <tr
                              key={member.memberId}
                              className={`border-b border-border last:border-0 ${
                                idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                              } hover:bg-muted/30 transition-colors`}
                            >
                              <td className="px-3 py-2.5 font-medium text-foreground">
                                {member.memberName}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">
                                {member.groupName}
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums">
                                {member.trainingCost.toFixed(2)} €
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums">
                                {member.membershipFee > 0
                                  ? `${member.membershipFee.toFixed(2)} €`
                                  : '–'}
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums">
                                {member.additionalFees > 0
                                  ? `${member.additionalFees.toFixed(2)} €`
                                  : '–'}
                              </td>
                              <td className="text-right px-3 py-2.5 tabular-nums font-semibold text-brand-primary">
                                {member.totalAmount.toFixed(2)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ▸ Grand Total Bar */}
                  <div className="flex items-center justify-between rounded-lg bg-brand-primary/5 border border-brand-primary/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/10">
                        <Euro className="h-4 w-4 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Gesamtsumme Saison-Abrechnung
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {billingPreview.memberCount} Mitglieder · {billingPreview.groupCount}{' '}
                          Gruppen
                        </p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-brand-primary tabular-nums">
                      {billingPreview.grandTotal.toFixed(2)} €
                    </p>
                  </div>

                  {/* ▸ Generate Invoices Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      size="lg"
                      className="gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white"
                      disabled={isGeneratingInvoices}
                      onClick={handleGenerateInvoices}
                    >
                      {isGeneratingInvoices ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Erstelle Rechnungen...
                        </>
                      ) : (
                        <>
                          <Receipt className="h-4 w-4" />
                          {billingPreview.memberCount} Rechnungen generieren
                        </>
                      )}
                    </Button>
                    <Link
                      href="/admin/billing"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Zur Abrechnung
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // === NO CONFLICTS — TRIGGER CHECK (only before first run) ===
  if (conflicts.length === 0 && !isLoading && !hasRunCheck) {
    return (
      <div className="space-y-6">
        {/* Pre-Confirmation Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-primary" />
                <p className="text-sm text-muted-foreground">Gruppen</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {state.clusteringResult?.groups.length || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {state.clusteringResult?.metrics.totalMembers || 0} Mitglieder
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">Niveau-Match</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {Math.round(state.clusteringResult?.metrics.avgNiveauMatch || 0)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">Trainer-Auslastung</p>
              </div>
              <p className="text-2xl font-bold mt-1">
                {Math.round(state.clusteringResult?.metrics.avgTrainerUtilization || 0)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">Konfliktprüfung starten</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Führen Sie die automatische Konfliktprüfung durch, bevor Sie die Planung final
              bestätigen.
            </p>
            <Button onClick={handleRunConflicts} className="mt-4 gap-2">
              <Sparkles className="h-4 w-4" />
              Konflikte prüfen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
        <p className="text-sm text-muted-foreground">Konfliktprüfung läuft...</p>
      </div>
    );
  }

  // === CONFLICTS DISPLAY ===
  return (
    <div className="space-y-6 pb-28">
      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Kritisch</p>
            </div>
            <p
              className={`text-xl font-bold mt-1 ${criticalConflicts.length > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {criticalConflicts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Warnungen</p>
            </div>
            <p className="text-xl font-bold mt-1">{warningConflicts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Gelöst / Ignoriert</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {resolvedCount}/{conflicts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              <p className="text-xs text-muted-foreground">Gruppen</p>
            </div>
            <p className="text-xl font-bold mt-1">{state.clusteringResult?.groups.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Conflicts */}
      {criticalConflicts.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              Kritische Konflikte — müssen gelöst werden
            </CardTitle>
            <CardDescription className="text-red-600">
              Diese Konflikte blockieren die finale Bestätigung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={false}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warningConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Warnungen & Hinweise
            </CardTitle>
            <CardDescription>Können bewusst akzeptiert oder gelöst werden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warningConflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                onIgnore={handleIgnore}
                isResolving={resolvingId === conflict.id}
                canIgnore={true}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* All clear message (after check ran or all resolved) */}
      {criticalConflicts.length === 0 &&
        warningConflicts.filter((c) => c.status === 'open').length === 0 && (
          <Card className="border-green-200 bg-green-50/30">
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-green-800">
                {conflicts.length === 0
                  ? 'Keine Konflikte gefunden'
                  : 'Alle Konflikte gelöst oder ignoriert'}
              </h3>
              <p className="text-sm text-green-700 mt-1">
                {conflicts.length === 0
                  ? 'Die Planung ist konfliktfrei und kann bestätigt werden.'
                  : 'Alle Konflikte wurden gelöst oder ignoriert.'}
              </p>
            </CardContent>
          </Card>
        )}

      {/* Warning Acceptance Checklist */}
      {warningConflicts.filter((c) => c.status === 'open').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-primary" />
              Warnungen akzeptieren
            </CardTitle>
            <CardDescription>
              Akzeptieren Sie jede Warnung bewusst. Dies wird im Protokoll festgehalten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warningConflicts
                .filter((c) => c.status === 'open')
                .map((conflict) => (
                  <label
                    key={conflict.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={confirmedWarnings.has(conflict.id)}
                      onCheckedChange={() => toggleWarning(conflict.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge
                          className={`text-xs ${
                            conflict.severity === 'warning'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {conflict.severity === 'warning' ? 'Warnung' : 'Hinweis'}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground">{conflict.description}</p>
                      {conflict.suggestedResolution && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-brand-primary" />
                          {conflict.suggestedResolution}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Review */}
      <Card className="border-purple-200 bg-purple-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-purple-800">
            <Brain className="h-4 w-4" />
            KI-Review der Planung
          </CardTitle>
          <CardDescription className="text-purple-600">
            Automatische Zusammenfassung und Bewertung vor der finalen Bestätigung
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aiReviewText ? (
            <div className="rounded-lg bg-background border border-purple-200 p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {aiReviewText}
              </p>
            </div>
          ) : hasRunAiReview ? (
            <p className="text-sm text-muted-foreground">KI-Review momentan nicht verfügbar.</p>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-purple-700 mb-3">
                Lassen Sie die KI eine Zusammenfassung und Bewertung der Planung erstellen, bevor
                Sie bestätigen.
              </p>
              <Button
                onClick={handleAiReview}
                disabled={aiReviewLoading}
                variant="outline"
                size="sm"
                className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                {aiReviewLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    KI-Review starten
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-primary" />
            Admin-Notiz (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
            placeholder='z.B. "Planung mit Vorstand abgestimmt am..."'
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Confirm Button — sticky bottom bar */}
      <div className="sticky bottom-0 bg-background dark:bg-background border-t border-border dark:border-border shadow-lg rounded-t-xl px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {hasBlockingConflicts ? (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Kritische Konflikte müssen zuerst gelöst werden
              </span>
            ) : !allWarningsAccepted ? (
              <span className="flex items-center gap-1 text-amber-600">
                <Info className="h-4 w-4" />
                Bitte alle Warnungen bestätigen
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                Bereit zur Bestätigung
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleRunConflicts} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Erneut prüfen
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={hasBlockingConflicts || !allWarningsAccepted || isConfirming}
              variant="brand"
              size="lg"
              className="gap-2"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Bestätige...
                </>
              ) : (
                <>
                  <ClipboardCheck className="h-4 w-4" />
                  Planung bestätigen & veröffentlichen
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BILLING KPI CARD
// ============================================
function BillingKpiCard({
  icon,
  label,
  value,
  subtitle,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-brand-primary/30 bg-brand-primary/5' : ''}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p
          className={`text-xl font-bold mt-1 tabular-nums ${
            highlight ? 'text-brand-primary' : 'text-foreground'
          }`}
        >
          {value.toFixed(2)} €
        </p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ============================================
// CONFLICT CARD
// ============================================
function ConflictCard({
  conflict,
  onResolve,
  onIgnore,
  isResolving,
  canIgnore,
}: {
  conflict: ConflictDetectionResult;
  onResolve: (id: string) => void;
  onIgnore: (id: string) => void;
  isResolving: boolean;
  canIgnore: boolean;
}) {
  const severityConfig: Record<ConflictSeverityLevel, { badgeColor: string }> = {
    critical: { badgeColor: 'bg-red-100 text-red-700' },
    warning: { badgeColor: 'bg-amber-100 text-amber-700' },
    info: { badgeColor: 'bg-blue-100 text-blue-700' },
  };
  const config = severityConfig[conflict.severity];
  const isOpen = conflict.status === 'open';

  return (
    <div
      className={`rounded-lg border p-4 ${
        conflict.status === 'resolved'
          ? 'border-green-200 bg-green-50/30 opacity-70'
          : conflict.status === 'ignored'
            ? 'border-border bg-muted/30 opacity-70'
            : conflict.severity === 'critical'
              ? 'border-red-200 bg-background'
              : 'border-amber-200 bg-background'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs ${config.badgeColor}`}>
              {conflict.severity === 'critical'
                ? 'Kritisch'
                : conflict.severity === 'warning'
                  ? 'Warnung'
                  : 'Hinweis'}
            </Badge>
            {conflict.status === 'resolved' && (
              <Badge className="text-xs bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3 mr-0.5" /> Gelöst
              </Badge>
            )}
            {conflict.status === 'ignored' && (
              <Badge className="text-xs bg-muted text-muted-foreground">
                <XCircle className="h-3 w-3 mr-0.5" /> Ignoriert
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{conflict.description}</p>
          {conflict.suggestedResolution && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brand-primary" />
              {conflict.suggestedResolution}
            </p>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(conflict.id)}
              disabled={isResolving}
              className="text-xs h-8"
            >
              <CheckCircle className="h-3 w-3 mr-1" /> Lösen
            </Button>
            {canIgnore && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onIgnore(conflict.id)}
                disabled={isResolving}
                className="text-xs h-8"
              >
                <XCircle className="h-3 w-3 mr-1" /> Ignorieren
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
