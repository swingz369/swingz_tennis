'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useWizard } from '@/lib/season-planning/wizard-context';
import { conflictFixTarget } from '@/lib/season-planning/conflict-utils';
import type { ConflictDetectionResult } from '@/lib/season-planning/types';
import {
  CheckCircle,
  AlertTriangle,
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
  ChevronRight,
  RefreshCw,
  Euro,
  Receipt,
  TrendingUp,
  DollarSign,
  Table2,
} from 'lucide-react';
import type { SeasonBillingPreview } from '@/lib/billing/season-billing.service';
import { apiFetch } from '@/lib/api-fetch';
import { ConflictList } from '@/components/season-planning/conflict-list';
import { DryRunPanel } from '@/components/admin/dry-run-panel';
import { InactiveWeeksPanel } from './inactive-weeks-panel';
import { SubstituteTrainerPanel } from './substitute-trainer-panel';

/**
 * FinalizeStep (Schritt 4 von 4)
 *
 * Responsibilities:
 * 1. Conflict Detection: Scan the plan for issues
 * 2. Conflict Management: Admin resolves or ignores conflicts
 * 3. AI Review: Optional AI-powered plan analysis
 * 4. Billing Preview: Show cost breakdown before publishing
 * 5. Final Confirmation: Publish plan to sessions
 * 6. Post-Publish: Show success metrics, invoices, waitlist
 */
export function FinalizeStep() {
  const { state, dispatch, confirmPlan, detectConflicts, goToStep } = useWizard();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
  const [hasRunCheck, setHasRunCheck] = useState(false);

  // Reset hasRunCheck when the plan changes (user went back to step 2)
  useEffect(() => {
    setHasRunCheck(false);
  }, [state.clusteringResult]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Billing preview state
  const [billingPreview, setBillingPreview] = useState<SeasonBillingPreview | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingFetched, setBillingFetched] = useState(false);

  const conflicts = state.conflicts;
  const criticalConflicts = conflicts.filter(
    (c) => c.severity === 'critical' && c.status === 'open'
  );
  // Nur offene Warnungen — eine gelöste oder ignorierte Warnung verschwand
  // vorher aus der Liste, wurde aber weiter für die Freigabe verlangt: der
  // Veröffentlichen-Knopf blieb mit "Bitte alle Warnungen bestätigen" gesperrt,
  // ohne dass es noch etwas zum Bestätigen gab.
  const warningConflicts = conflicts.filter(
    (c) => (c.severity === 'warning' || c.severity === 'info') && c.status === 'open'
  );
  const hasBlockingConflicts = criticalConflicts.length > 0;
  const decidedCount = conflicts.filter((c) => c.status !== 'open').length;

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

  // "Beheben" springt in den Schritt, in dem die Ursache liegt, statt — wie der
  // frühere Knopf "Lösen" — nur einen Status zu schreiben, an dem sich in den
  // Daten nichts ändert. Der Konflikt verschwindet erst, wenn die nächste
  // Prüfung ihn nicht mehr findet.
  const handleFix = useCallback(
    (conflict: ConflictDetectionResult) => {
      const target = conflictFixTarget(conflict.type);
      toast.info('Zum Konflikt gesprungen', {
        description: `${conflict.description}\n\n${target.hint}`,
        duration: 10000,
      });
      goToStep(target.step);
    },
    [goToStep]
  );

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

  const handleConfirm = useCallback(async () => {
    if (hasBlockingConflicts) return;
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
  }, [hasBlockingConflicts, confirmPlan]);

  // Fetch billing preview as soon as a plan exists (not just after confirm)
  useEffect(() => {
    if (
      (state.isConfirmed || (state.clusteringResult?.groups.length ?? 0) > 0) &&
      !billingFetched
    ) {
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
  }, [state.isConfirmed, state.clusteringResult, billingFetched, state.seasonId]);

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
        <Card className="border-success-200 bg-success-50/30">
          <CardContent className="py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100 mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h2 className="text-xl font-bold text-success-800">Planung erfolgreich bestätigt!</h2>
            <p className="text-sm text-success-700 mt-2 max-w-md mx-auto">
              Trainingsgruppen und Sessions wurden erstellt und in die Profile der Trainer und
              Mitglieder übertragen. Alle Beteiligten werden automatisch benachrichtigt.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
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
                <Calendar className="h-4 w-4 text-success-500" />
                <p className="text-sm text-muted-foreground">Sessions</p>
              </div>
              <p className="text-2xl font-bold mt-1">{state.publishedSessionIds.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-warning-500" />
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
                <Clock className="h-4 w-4 text-info-500" />
                Wartelisten-Benachrichtigungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.clusteringResult?.waitlistSummary.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-success-500" />
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
                  <Receipt className="h-4 w-4 text-primary" />
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
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Berechne Abrechnungs-Vorschau...</p>
              </div>
            )}

            {/* ── Error State ── */}
            {!billingLoading && billingError && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <AlertTriangle className="h-8 w-8 text-warning-500" />
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
                  <Info className="h-8 w-8 text-info-400" />
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
                      icon={<Euro className="h-4 w-4 text-primary" />}
                      label="Trainingskosten"
                      value={billingPreview.totalTrainingCost}
                      subtitle={`${billingPreview.groupCount} Gruppen`}
                    />
                    <BillingKpiCard
                      icon={<Users className="h-4 w-4 text-info-500" />}
                      label="Mitgliedsbeiträge"
                      value={billingPreview.totalMembershipFees}
                      subtitle={`${billingPreview.memberCount} Mitglieder`}
                    />
                    <BillingKpiCard
                      icon={<DollarSign className="h-4 w-4 text-warning-500" />}
                      label="Zusatzgebühren"
                      value={billingPreview.totalAdditionalFees}
                      subtitle={billingPreview.totalAdditionalFees > 0 ? 'Konfiguriert' : 'Keine'}
                    />
                    <BillingKpiCard
                      icon={<TrendingUp className="h-4 w-4 text-success-600" />}
                      label="Gesamtsumme"
                      value={billingPreview.grandTotal}
                      subtitle="Alle Posten"
                      highlight
                    />
                  </div>

                  {/* ▸ Config Info */}
                  {billingPreview.config && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                      <span className="font-medium text-foreground">Konfiguration:</span>
                      <Badge variant="secondary" className="text-2xs">
                        Stundensatz {billingPreview.config.trainer_hourly_rate.toFixed(2)} €
                      </Badge>
                      {billingPreview.config.use_trainer_profile_rate && (
                        <Badge variant="secondary" className="text-2xs">
                          Trainer-Profile
                        </Badge>
                      )}
                      {billingPreview.config.include_membership_fee && (
                        <Badge variant="secondary" className="text-2xs">
                          Mitgliedsbeitrag inkl.
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-2xs">
                        MwSt. {billingPreview.config.tax_rate}%
                      </Badge>
                      <Badge variant="secondary" className="text-2xs">
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
                    <div className="rounded-xl border border-border overflow-hidden">
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
                              <td className="text-right px-3 py-2.5 tabular-nums font-medium text-primary">
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
                      <Badge variant="secondary" className="text-2xs ml-1">
                        {billingPreview.memberPreviews.length}
                      </Badge>
                    </h4>
                    <div className="rounded-xl border border-border overflow-hidden max-h-[420px] overflow-y-auto">
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
                              <td className="text-right px-3 py-2.5 tabular-nums font-semibold text-primary">
                                {member.totalAmount.toFixed(2)} €
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ▸ Grand Total Bar */}
                  <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <Euro className="h-4 w-4 text-primary" />
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
                    <p className="text-2xl font-bold text-primary tabular-nums">
                      {billingPreview.grandTotal.toFixed(2)} €
                    </p>
                  </div>

                  {/* ▸ Generate Invoices Button */}
                  <div className="flex items-center gap-3">
                    <Button
                      size="lg"
                      className="gap-2 bg-primary hover:bg-primary/90 text-white"
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
                <Users className="h-4 w-4 text-primary" />
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
                <ClipboardCheck className="h-4 w-4 text-success-500" />
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
                <Star className="h-4 w-4 text-warning-500" />
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
            <CheckCircle className="h-12 w-12 text-success-500 mx-auto" />
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
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
              <AlertTriangle className="h-4 w-4 text-error-500" />
              <p className="text-xs text-muted-foreground">Kritisch</p>
            </div>
            <p
              className={`text-xl font-bold mt-1 ${criticalConflicts.length > 0 ? 'text-error-600' : 'text-success-600'}`}
            >
              {criticalConflicts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              <p className="text-xs text-muted-foreground">Warnungen</p>
            </div>
            <p className="text-xl font-bold mt-1">{warningConflicts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-info-500" />
              <p className="text-xs text-muted-foreground">Gelöst / Ignoriert</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {decidedCount}/{conflicts.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Gruppen</p>
            </div>
            <p className="text-xl font-bold mt-1">{state.clusteringResult?.groups.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Dieselbe Liste wie unter /admin/seasons/[id]/conflicts — vorher waren
          das zwei Implementierungen mit abweichendem Verhalten.
          Die frühere Checkliste "Warnungen akzeptieren" ist entfallen: dieselbe
          Warnung war dreifach zu quittieren (Lösen, Ignorieren, Häkchen), und
          nur das Häkchen entschied über die Freigabe. "Ignorieren" hält die
          bewusste Annahme jetzt mit Notiz in der Datenbank fest. */}
      <ConflictList
        conflicts={conflicts}
        onFix={handleFix}
        onIgnore={handleIgnore}
        resolvingId={resolvingId}
      />

      {/* Inactive Weeks Panel */}
      <InactiveWeeksPanel />

      {/* Substitute Trainer Panel */}
      <SubstituteTrainerPanel />

      {/* Dry-Run Preview — simulates the full publish workflow (read-only) */}
      <DryRunPanel seasonId={state.seasonId} />

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Admin-Notiz (optional)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-[80px] rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y"
            placeholder='z.B. "Planung mit Vorstand abgestimmt am..."'
            value={state.adminNotes}
            onChange={(e) => dispatch({ type: 'SET_ADMIN_NOTES', notes: e.target.value })}
          />
        </CardContent>
      </Card>

      {/* Confirm Button — sticky bottom bar */}
      <div className="sticky bottom-0 bg-background dark:bg-background border-t border-border dark:border-border shadow-lg rounded-t-xl px-6 py-4 z-10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {hasBlockingConflicts ? (
              <span className="flex items-center gap-1 text-error-600">
                <AlertTriangle className="h-4 w-4" />
                Kritische Konflikte müssen zuerst gelöst werden
              </span>
            ) : warningConflicts.length > 0 ? (
              <span className="flex items-center gap-1 text-warning-600">
                <Info className="h-4 w-4" />
                {warningConflicts.length} offene Warnung
                {warningConflicts.length !== 1 ? 'en' : ''} — Veröffentlichen ist möglich
              </span>
            ) : (
              <span className="flex items-center gap-1 text-success-600">
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
              disabled={hasBlockingConflicts || isConfirming}
              variant="primary"
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
    <Card className={highlight ? 'border-primary/30 bg-primary/5' : ''}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <p
          className={`text-xl font-bold mt-1 tabular-nums ${
            highlight ? 'text-primary' : 'text-foreground'
          }`}
        >
          {value.toFixed(2)} €
        </p>
        <p className="text-2xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
