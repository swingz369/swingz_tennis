'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, Copy, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { exportMembersCSV, exportTrainersCSV } from '@/lib/csv-export';
import { ALL_LIMIT } from '@/lib/pagination';
import { ModuleSelectionStep } from '@/components/onboarding/module-selection-step';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import MemberImportDialog from '@/components/admin/member-import-dialog';
import TrainerImportDialog from '@/components/admin/trainer-import-dialog';
import { createLogger } from '@/lib/logger';

const log = createLogger('settings-client');

/**
 * Lädt den vollständigen Bestand und schreibt ihn als CSV.
 *
 * Der Export saß vorher in der Mitgliederliste und exportierte nur die gerade
 * angezeigte, server-seitig paginierte Seite — wer 300 Mitglieder hatte, bekam die
 * ersten 50. Hier wird bewusst ohne Seitengrenze geladen.
 */
function CsvExportButton({ kind }: { kind: 'members' | 'trainers' }) {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      if (kind === 'members') {
        const res = await apiFetch(`/api/members?limit=${ALL_LIMIT}`);
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        const members = data.members ?? [];
        if (members.length === 0) {
          toast.info('Keine Mitglieder zum Exportieren');
          return;
        }
        exportMembersCSV(members);
      } else {
        const res = await apiFetch('/api/trainer-profiles');
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        const trainers = data.profiles ?? [];
        if (!Array.isArray(trainers) || trainers.length === 0) {
          toast.info('Keine Trainer zum Exportieren');
          return;
        }
        exportTrainersCSV(trainers);
      }
      toast.success('Export gestartet');
    } catch (error) {
      log.error('CSV-Export fehlgeschlagen', error instanceof Error ? error : undefined);
      toast.error('Export fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Export
    </Button>
  );
}

type DayHours = {
  open: string;
  close: string;
  closed?: boolean;
};

type OpeningHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const WEEKDAY_LABELS: Record<keyof OpeningHours, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

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
] as const;

type ClubSettings = {
  id: string;
  name: string;
  maxMembers: number;
  status: 'active' | 'inactive' | 'suspended';
  openingHours: OpeningHours;
  bundesland?: string;
  billing_unit_minutes?: 45 | 60;
  tax_rate?: number;
  taxEnabled: boolean;
  default_payment_method?: 'sepa' | 'transfer' | 'cash' | 'stripe';
  invoice_number_prefix?: string;
};

type SystemSettings = {
  appName: string;
  emailNotifications: boolean;
  reminderDaysBefore: number;
  stripePublicKey: string;
};

const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday: { open: '09:00', close: '22:00' },
  tuesday: { open: '09:00', close: '22:00' },
  wednesday: { open: '09:00', close: '22:00' },
  thursday: { open: '09:00', close: '22:00' },
  friday: { open: '09:00', close: '22:00' },
  saturday: { open: '09:00', close: '22:00' },
  sunday: { open: '09:00', close: '22:00' },
};

/**
 * Baut aus den (unvollständigen) DB-Daten ein vollständiges OpeningHours-Objekt.
 * `opening_hours` ist JSONB und kann bei Alt-Vereinen leer oder in einem
 * abweichenden Format vorliegen — fehlende Tage/Felder fallen auf die Defaults zurück.
 */
function normalizeOpeningHours(raw: unknown): OpeningHours {
  const normalized = {} as OpeningHours;
  for (const day of DAY_KEYS) {
    const entry =
      raw && typeof raw === 'object'
        ? ((raw as Record<string, unknown>)[day] as Record<string, unknown> | undefined)
        : undefined;
    normalized[day] = {
      open: entry && typeof entry.open === 'string' ? entry.open : DEFAULT_OPENING_HOURS[day].open,
      close:
        entry && typeof entry.close === 'string' ? entry.close : DEFAULT_OPENING_HOURS[day].close,
      closed: Boolean(entry && entry.closed === true),
    };
  }
  return normalized;
}

/** Tab „Verein": Stammdaten, Öffnungszeiten, Abrechnung + CSV-Import. */
export function ClubSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [clubSettings, setClubSettings] = useState<ClubSettings>({
    id: '',
    name: '',
    maxMembers: 100,
    status: 'active',
    openingHours: DEFAULT_OPENING_HOURS,
    billing_unit_minutes: 60,
    tax_rate: 0,
    taxEnabled: false,
    default_payment_method: 'transfer',
    invoice_number_prefix: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const clubRes = await apiFetch('/api/user/club');
        if (clubRes.ok) {
          const clubData = await clubRes.json();
          if (!cancelled) {
            setClubSettings((prev) => ({
              ...prev,
              id: clubData.clubId,
              name: clubData.club.name || '',
              maxMembers: clubData.club.maxMembers || 100,
              openingHours: normalizeOpeningHours(clubData.club.openingHours),
              status: clubData.club.status || 'active',
              ...(clubData.club.bundesland != null ? { bundesland: clubData.club.bundesland } : {}),
              billing_unit_minutes: clubData.club.billingUnitMinutes === 45 ? 45 : 60,
              tax_rate: clubData.club.tax_rate ?? 0,
              taxEnabled: (clubData.club.tax_rate ?? 0) > 0,
              default_payment_method: (['sepa', 'transfer', 'cash', 'stripe'] as const).includes(
                clubData.club.defaultPaymentMethod
              )
                ? clubData.club.defaultPaymentMethod
                : 'transfer',
              invoice_number_prefix: clubData.club.invoicePrefix ?? '',
            }));
          }
        } else {
          if (!cancelled) {
            setLoadError(true);
            toast.error(
              clubRes.status === 401
                ? 'Sitzung abgelaufen — bitte Seite neu laden und erneut anmelden'
                : 'Einstellungen konnten nicht geladen werden — bitte Seite neu laden'
            );
          }
        }
      } catch (err) {
        log.error('Failed to fetch settings', err instanceof Error ? err : undefined);
        if (!cancelled) {
          setLoadError(true);
          toast.error('Fehler beim Laden der Einstellungen');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveClubSettings = async () => {
    if (loadError) {
      toast.error('Speichern nicht möglich — Einstellungen konnten nicht geladen werden');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubSettings.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clubSettings.name,
          maxMembers: clubSettings.maxMembers,
          openingHours: clubSettings.openingHours,
          status: clubSettings.status,
          bundesland: clubSettings.bundesland,
          billing_unit_minutes: clubSettings.billing_unit_minutes,
          tax_rate: clubSettings.taxEnabled ? clubSettings.tax_rate : 0,
          default_payment_method: clubSettings.default_payment_method,
          invoice_number_prefix: clubSettings.invoice_number_prefix,
        }),
      });

      if (res.ok) {
        toast.success('Vereinseinstellungen gespeichert');
      } else {
        const error = await res.json();
        toast.error(`Fehler: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      log.error('Failed to save club settings', err instanceof Error ? err : undefined);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: keyof OpeningHours, patch: Partial<DayHours>) =>
    setClubSettings((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: { ...prev.openingHours[day], ...patch },
      },
    }));

  // Montag als Referenz auf alle Wochentage übertragen — ein Klick statt sieben.
  const applyMondayToAll = () => {
    const { open, close } = clubSettings.openingHours.monday;
    setClubSettings((prev) => {
      const openingHours = { ...prev.openingHours };
      for (const day of DAY_KEYS) {
        openingHours[day] = { open, close, closed: false };
      }
      return { ...prev, openingHours };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Einstellungen konnten nicht geladen werden</AlertTitle>
          <AlertDescription>
            Die angezeigten Werte sind möglicherweise nicht aktuell. Bitte Seite neu laden, bevor
            gespeichert wird — Speichern ist so lange deaktiviert.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Vereinsdaten</CardTitle>
          <CardDescription>
            Stammdaten, Öffnungszeiten und Abrechnung deines Vereins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stammdaten */}
          <div>
            <Label htmlFor="clubName">Vereinsname</Label>
            <Input
              id="clubName"
              value={clubSettings.name}
              onChange={(e) => {
                const newName = e.target.value;
                setClubSettings((prev) => ({ ...prev, name: newName }));
              }}
            />
          </div>

          <Separator />

          {/* Öffnungszeiten */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label className="text-base font-semibold">Öffnungszeiten</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Lege fest, wann dein Verein geöffnet ist — geschlossene Tage werden deaktiviert.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={applyMondayToAll}
              >
                <Copy className="h-4 w-4" />
                Montag auf alle Tage
              </Button>
            </div>

            <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {DAY_KEYS.map((day) => {
                const hours = clubSettings.openingHours[day];
                const closed = hours.closed === true;
                return (
                  <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <span className="w-28 shrink-0 text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${WEEKDAY_LABELS[day]} – öffnet um`}
                        value={hours.open}
                        disabled={closed}
                        onChange={(e) => updateDay(day, { open: e.target.value })}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        aria-label={`${WEEKDAY_LABELS[day]} – schließt um`}
                        value={hours.close}
                        disabled={closed}
                        onChange={(e) => updateDay(day, { close: e.target.value })}
                        className="w-28"
                      />
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Switch
                        id={`day-closed-${day}`}
                        checked={!closed}
                        onCheckedChange={(isOpen) => updateDay(day, { closed: !isOpen })}
                        aria-label={`${WEEKDAY_LABELS[day]} geöffnet`}
                      />
                      <Label
                        htmlFor={`day-closed-${day}`}
                        className={closed ? 'text-sm text-muted-foreground' : 'text-sm'}
                      >
                        {closed ? 'Geschlossen' : 'Geöffnet'}
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Billing Configuration */}
          <div>
            <Label className="text-base font-semibold">Abrechnung</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Steuer- und Zahlungsvorgaben für Rechnungen
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="bundesland">Bundesland</Label>
                <Select
                  value={clubSettings.bundesland ?? ''}
                  onValueChange={(value) => setClubSettings({ ...clubSettings, bundesland: value })}
                >
                  <SelectTrigger id="bundesland">
                    <SelectValue placeholder="Bundesland wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDESLAENDER.map((bl) => (
                      <SelectItem key={bl} value={bl}>
                        {bl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="billing_unit_minutes">Abrechnungseinheit</Label>
                <Select
                  value={String(clubSettings.billing_unit_minutes ?? 60)}
                  onValueChange={(value) =>
                    setClubSettings({
                      ...clubSettings,
                      billing_unit_minutes: Number(value) as 45 | 60,
                    })
                  }
                >
                  <SelectTrigger id="billing_unit_minutes">
                    <SelectValue placeholder="Einheit wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45 Minuten</SelectItem>
                    <SelectItem value="60">60 Minuten</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="default_payment_method">Zahlungsweg</Label>
                <Select
                  value={clubSettings.default_payment_method ?? 'transfer'}
                  onValueChange={(value: 'sepa' | 'transfer' | 'cash' | 'stripe') =>
                    setClubSettings({ ...clubSettings, default_payment_method: value })
                  }
                >
                  <SelectTrigger id="default_payment_method">
                    <SelectValue placeholder="Zahlungsweg wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sepa">SEPA-Lastschrift</SelectItem>
                    <SelectItem value="transfer">Überweisung</SelectItem>
                    <SelectItem value="cash">Barzahlung</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invoice_number_prefix">Rechnungsnummer-Präfix</Label>
                <Input
                  id="invoice_number_prefix"
                  type="text"
                  maxLength={10}
                  value={clubSettings.invoice_number_prefix ?? ''}
                  onChange={(e) =>
                    setClubSettings({
                      ...clubSettings,
                      invoice_number_prefix: e.target.value.slice(0, 10),
                    })
                  }
                  placeholder="z.B. RE"
                  className="w-48"
                />
                <p className="text-sm text-muted-foreground mt-1">Ergibt z. B. RE-202608-00001</p>
              </div>
            </div>

            <Separator className="my-5" />

            {/* Umsatzsteuer — opt-in, v. a. für gewerbliche Anbieter (Tennisschulen). */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="taxEnabled">Umsatzsteuer erheben</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Nur für gewerbliche Anbieter wie Tennisschulen — gemeinnützige Vereine lassen dies
                  aus
                </p>
                {clubSettings.taxEnabled && (
                  <div className="mt-3">
                    <Label htmlFor="tax_rate">Steuersatz (%)</Label>
                    <Input
                      id="tax_rate"
                      type="number"
                      min={0}
                      max={19}
                      value={clubSettings.tax_rate ?? 0}
                      onChange={(e) =>
                        setClubSettings({
                          ...clubSettings,
                          tax_rate: Math.min(19, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-48 mt-1"
                    />
                  </div>
                )}
              </div>
              <Switch
                id="taxEnabled"
                checked={clubSettings.taxEnabled}
                onCheckedChange={(checked) =>
                  setClubSettings({ ...clubSettings, taxEnabled: checked })
                }
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end border-t border-border pt-5">
            <Button onClick={handleSaveClubSettings} disabled={saving || loadError}>
              {saving ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CSV-Import und -Export (Massenvorgänge, gehören nicht in die tägliche
          Mitglieder-/Trainerverwaltung — dort standen sie vorher verstreut). */}
      <Card>
        <CardHeader>
          <CardTitle>CSV-Import &amp; -Export</CardTitle>
          <CardDescription>
            Mehrere Mitglieder oder Trainer auf einmal aus einer CSV-Datei importieren oder den
            aktuellen Bestand als CSV herunterladen
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <span className="text-sm font-medium">Mitglieder</span>
            <div className="flex items-center gap-2">
              <MemberImportDialog />
              <CsvExportButton kind="members" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
            <span className="text-sm font-medium">Trainer</span>
            <div className="flex items-center gap-2">
              <TrainerImportDialog />
              <CsvExportButton kind="trainers" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Tab „System": globale SWINGZ-Konfiguration (nur Superadmin). */
export function SystemSettingsContent() {
  const [saving, setSaving] = useState(false);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    appName: 'SWINGZ',
    emailNotifications: true,
    reminderDaysBefore: 1,
    stripePublicKey: '',
  });

  const handleSaveSystemSettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/system/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings),
      });

      if (res.ok) {
        toast.success('Systemeinstellungen gespeichert');
      } else {
        const error = await res.json();
        toast.error(`Fehler: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      log.error('Failed to save system settings', err instanceof Error ? err : undefined);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Systemeinstellungen</CardTitle>
        <CardDescription>Globale Konfiguration für SWINGZ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="appName">Anwendungsname</Label>
          <Input
            id="appName"
            value={systemSettings.appName}
            onChange={(e) => setSystemSettings({ ...systemSettings, appName: e.target.value })}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="emailNotifications">E-Mail-Benachrichtigungen</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Buchungs- und Erinnerungs-E-Mails an Mitglieder senden
            </p>
          </div>
          <Switch
            id="emailNotifications"
            checked={systemSettings.emailNotifications}
            onCheckedChange={(checked) =>
              setSystemSettings({ ...systemSettings, emailNotifications: checked })
            }
          />
        </div>

        <div>
          <Label htmlFor="reminderDays">Erinnerung (Tage vorher)</Label>
          <Input
            id="reminderDays"
            type="number"
            min="1"
            max="7"
            value={systemSettings.reminderDaysBefore}
            onChange={(e) =>
              setSystemSettings({
                ...systemSettings,
                reminderDaysBefore: parseInt(e.target.value) || 1,
              })
            }
            className="w-48"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Wie viele Tage vor einer Buchung erinnert werden soll
          </p>
        </div>

        <Separator />

        <div>
          <Label htmlFor="stripeKey">Stripe Public Key</Label>
          <Input
            id="stripeKey"
            type="password"
            value={systemSettings.stripePublicKey}
            onChange={(e) =>
              setSystemSettings({ ...systemSettings, stripePublicKey: e.target.value })
            }
            placeholder="pk_live_..."
          />
          <p className="text-sm text-muted-foreground mt-1">
            Wird für die Zahlungsabwicklung benötigt
          </p>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button onClick={handleSaveSystemSettings} disabled={saving}>
            {saving ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Tab „Module": optionale Bereiche des Vereins aktivieren/deaktivieren. */
export function ModuleSettingsContent({ clubId }: { clubId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modul-Auswahl</CardTitle>
        <CardDescription>
          Aktiviere oder deaktiviere optionale Bereiche deines Vereins. Grundfunktionen
          (Mitgliederverwaltung, Trainer, Saisonplanung, Finanzen) sind immer aktiv.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* showContinue=false: jeder Schalter speichert sofort (autoSave) —
            ein zusätzlicher „Auswahl speichern"-Button wäre redundant und
            würde suggerieren, man müsse manuell sichern. */}
        <ModuleSelectionStep clubId={clubId} showContinue={false} />
      </CardContent>
    </Card>
  );
}
