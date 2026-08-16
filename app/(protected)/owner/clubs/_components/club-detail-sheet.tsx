'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

/**
 * ClubDetailSheet — Phase 2 Owner-Master-Drawer
 *
 * Slide-in-Panel von rechts mit zwei Sektionen:
 *   1. Snapshot (read-only) — Admin-Email, Stripe-Status, Mitgliederauslastung
 *   2. Edit-Form — alle über PATCH /api/clubs/[id] setzbaren Felder
 *
 * Speichern sendet genau den PATCH. Anschließend wird dem Parent ein
 * onSaved-Callback gegeben, damit /owner/clubs die Liste re-fetchen kann.
 *
 * "Dirty-State" wird per JSON.stringify-Vergleich erkannt — bei FALSE ist
 * der Save-Button disabled, damit keine No-Op-PATCHes das Audit-Log
 * zumüllen.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Save,
  ExternalLink,
  Mail,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { recommendSoloPlan, PLAN_LABELS } from '@/lib/plans';

const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
];

const TIER_LABELS: Record<string, string> = {
  free: 'Kein Abo',
  solo_s: 'Einzelverein S',
  solo_l: 'Einzelverein L',
  school_s: 'Tennisschule S',
  school_l: 'Tennisschule L',
  starter: 'Starter',
  professional: 'Professional',
};

const STATUS_CFG: Record<
  string,
  {
    label: string;
    variant: 'success' | 'warning' | 'secondary' | 'error';
    Icon: typeof CheckCircle2;
  }
> = {
  active: { label: 'Aktiv', variant: 'success', Icon: CheckCircle2 },
  trialing: { label: 'Trial', variant: 'warning', Icon: Clock },
  past_due: { label: 'Überfällig', variant: 'error', Icon: AlertCircle },
  canceled: { label: 'Gekündigt', variant: 'secondary', Icon: XCircle },
  inactive: { label: 'Inaktiv', variant: 'secondary', Icon: AlertCircle },
};

interface AdminSnapshot {
  email: string;
  full_name: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

interface ClubDetail {
  id: string;
  name: string;
  status: string;
  maxMembers: number;
  bundesland: string | null;
  billing_unit_minutes: number | null;
  tax_rate: number | null;
  default_payment_method: string | null;
  invoice_number_prefix: string | null;
  memberCount: number;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  admin: AdminSnapshot | null;
  stripe_live_mode: boolean;
}

interface FormState {
  name: string;
  city: string;
  description: string;
  logo_url: string;
  status: string;
  max_members: number;
  bundesland: string;
  billing_unit_minutes: number;
  tax_rate: number;
  default_payment_method: string;
  invoice_number_prefix: string;
}

function toForm(d: ClubDetail): FormState {
  return {
    name: d.name ?? '',
    city: d.city ?? '',
    description: d.description ?? '',
    logo_url: d.logo_url ?? '',
    status: d.status ?? 'active',
    max_members: d.maxMembers ?? 100,
    bundesland: d.bundesland ?? '',
    billing_unit_minutes: d.billing_unit_minutes ?? 60,
    tax_rate: d.tax_rate ?? 0,
    default_payment_method: d.default_payment_method ?? 'transfer',
    invoice_number_prefix: d.invoice_number_prefix ?? '',
  };
}

function sameForm(a: FormState | null, b: FormState | null): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ClubDetailSheet({
  clubId,
  onClose,
  onSaved,
}: {
  clubId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<ClubDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [originalForm, setOriginalForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId) {
      setDetail(null);
      setForm(null);
      setOriginalForm(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    apiFetch(`/api/clubs/${clubId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ClubDetail) => {
        setDetail(data);
        const f = toForm(data);
        setForm(f);
        setOriginalForm(f);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Fehler beim Laden'))
      .finally(() => setLoading(false));
  }, [clubId]);

  const isDirty = useMemo(() => !sameForm(form, originalForm), [form, originalForm]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleReset = () => {
    if (originalForm) setForm({ ...originalForm });
  };

  const handleSave = async () => {
    if (!form || !clubId || !isDirty) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}`, {
        method: 'PATCH',
        // API-Schema erwartet camelCase für maxMembers — Form-State ist
        // snake_case, hier explizit gemappt statt Feldnamen zu duplizieren.
        body: JSON.stringify({
          ...form,
          maxMembers: form.max_members,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          extractErrorMessage(data) || data.details?.[0]?.message || 'Fehler beim Speichern'
        );
        return;
      }
      toast.success('Änderungen gespeichert');
      setOriginalForm({ ...form });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!clubId} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {detail?.name || 'Verein'}
          </SheetTitle>
          <SheetDescription>Vereinsdaten bearbeiten · Read-only Snapshots unten</SheetDescription>
          <SheetClose className="absolute right-4 top-4" />
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Lade Vereins-Details…</span>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-md border border-error-300 bg-error-50 p-4 text-sm text-error-700 dark:border-error-700/50 dark:bg-error-900/20 dark:text-error-300 mt-6"
          >
            {error}
          </div>
        ) : detail && form ? (
          <div className="mt-6 space-y-6">
            {/* ── Read-Only-Snapshot ────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Snapshot (read-only)
              </h3>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Vereins-Admin</p>
                      {detail.admin ? (
                        <>
                          <a
                            href={`mailto:${detail.admin.email}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {detail.admin.full_name || detail.admin.email}
                          </a>
                          <p className="text-xs text-muted-foreground truncate">
                            {detail.admin.email}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Kein Admin zugewiesen
                        </p>
                      )}
                    </div>
                  </div>

                  {detail.admin?.subscription_tier !== null && detail.admin && (
                    <div className="flex items-center gap-2 pt-3 border-t border-border dark:border-white/10">
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {TIER_LABELS[detail.admin.subscription_tier ?? 'free'] ??
                            detail.admin.subscription_tier ??
                            '—'}
                        </Badge>
                        {(() => {
                          const cfg =
                            STATUS_CFG[detail.admin.subscription_status ?? 'inactive'] ??
                            STATUS_CFG.inactive;
                          const StatusIcon = cfg.Icon;
                          return (
                            <Badge variant={cfg.variant} className="gap-1 text-xs">
                              <StatusIcon className="h-3 w-3" /> {cfg.label}
                            </Badge>
                          );
                        })()}
                        {detail.admin.current_period_end && (
                          <span className="text-xs text-muted-foreground">
                            bis{' '}
                            {new Date(detail.admin.current_period_end).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                      {detail.admin.stripe_customer_id && (
                        <a
                          href={`https://dashboard.stripe.com/${detail.stripe_live_mode ? '' : 'test/'}customers/${detail.admin.stripe_customer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="In Stripe öffnen"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Stripe
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-3 border-t border-border dark:border-white/10">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">Mitglieder</p>
                      <p className="text-sm font-medium">
                        {detail.memberCount ?? 0}
                        <span className="ml-2 text-xs text-muted-foreground">
                          (kein Limit — Tarif:{' '}
                          {PLAN_LABELS[recommendSoloPlan(detail.memberCount ?? 0)]})
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ── Edit-Form ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vereinsdaten
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cd-name">Vereinsname</Label>
                  <Input
                    id="cd-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={200}
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cd-city">Stadt</Label>
                    <Input
                      id="cd-city"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      maxLength={200}
                      className="mt-1.5"
                      placeholder="Musterstadt"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cd-bundesland">Bundesland</Label>
                    <Select
                      value={form.bundesland || '_none'}
                      onValueChange={(v) =>
                        setForm({ ...form, bundesland: v === '_none' ? '' : v })
                      }
                    >
                      <SelectTrigger id="cd-bundesland" className="mt-1.5">
                        <SelectValue placeholder="Bundesland wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— keins —</SelectItem>
                        {BUNDESLAENDER.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cd-status">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger id="cd-status" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="inactive">Inaktiv</SelectItem>
                        <SelectItem value="suspended">Gesperrt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cd-max">Max. Mitglieder</Label>
                    <Input
                      id="cd-max"
                      type="number"
                      min={1}
                      max={10000}
                      value={form.max_members}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          max_members: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cd-tax">USt. (%)</Label>
                  <Input
                    id="cd-tax"
                    type="number"
                    min={0}
                    max={19}
                    value={form.tax_rate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tax_rate: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="mt-1.5"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cd-billing">Abrechnungs-Einheit</Label>
                    <Select
                      value={String(form.billing_unit_minutes)}
                      onValueChange={(v) =>
                        setForm({ ...form, billing_unit_minutes: parseInt(v, 10) })
                      }
                    >
                      <SelectTrigger id="cd-billing" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cd-payment">Standard-Zahlweg</Label>
                    <Select
                      value={form.default_payment_method}
                      onValueChange={(v) => setForm({ ...form, default_payment_method: v })}
                    >
                      <SelectTrigger id="cd-payment" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sepa">SEPA</SelectItem>
                        <SelectItem value="transfer">Überweisung</SelectItem>
                        <SelectItem value="cash">Bargeld</SelectItem>
                        <SelectItem value="stripe">Stripe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="cd-prefix">Rechnungs-Nr. Präfix</Label>
                  <Input
                    id="cd-prefix"
                    value={form.invoice_number_prefix}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        invoice_number_prefix: e.target.value.slice(0, 10),
                      })
                    }
                    maxLength={10}
                    className="mt-1.5"
                    placeholder="RE-2026-"
                  />
                </div>
                <div>
                  <Label htmlFor="cd-desc">Beschreibung</Label>
                  <Input
                    id="cd-desc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value.slice(0, 2000) })
                    }
                    maxLength={2000}
                    className="mt-1.5"
                    placeholder="Kurzbeschreibung des Vereins"
                  />
                </div>
                <div>
                  <Label htmlFor="cd-logo">Logo-URL</Label>
                  <Input
                    id="cd-logo"
                    type="url"
                    value={form.logo_url}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    maxLength={500}
                    className="mt-1.5"
                    placeholder="https://…"
                  />
                  {form.logo_url && (
                    <div className="mt-2 flex items-center gap-3">
                      {/* Remote club branding — Next/Image would require a configured loader. */}
                      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/no-noninteractive-element-interactions */}
                      <img
                        src={form.logo_url}
                        alt="Logo-Vorschau"
                        className="h-12 w-12 rounded object-cover border border-border"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Lokale Vorschau — tatsächliches Rendering hängt vom Branding-Konsumenten ab.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        ) : null}

        <SheetFooter>
          <Button variant="ghost" onClick={handleReset} disabled={!isDirty || saving}>
            Zurücksetzen
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || saving || loading || !form}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
