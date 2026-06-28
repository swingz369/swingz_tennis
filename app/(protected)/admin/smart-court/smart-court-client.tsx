'use client';

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * app/(protected)/admin/smart-court/smart-court-client.tsx — Q3 ticket 3.1.3 UI
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Layout
 *   1) Page-Header (Smart-Court-Hero + Beschreibung)
 *   2) Vendor-Selection-Card (RadioGroup, 3 Cards: Nuki/Shelly/Loxone)
 *   3) Save-Button mit Save-/Loader-State
 *   4) Aktive-Plätze-Read-Only-List (Vendor-Indikator pro Court)
 *
 * ADR-002 Forensic-Policy
 *   - Save-Failure immer als Toast-Error mit `json.error`-Message
 *   - missing_env-Warning als eigene Toast-Warning 8s-Duration
 *   - Idempotency: Server-Antwort `unchanged: true` → info-Toast (kein Erfolgs-Toast)
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import {
  Cpu,
  DoorOpen,
  Lightbulb,
  Lock,
  Sparkles,
  Save,
  Loader2,
  Info as InfoIcon,
} from 'lucide-react';
import type { HardwareVendor } from '@/lib/hardware/adapter';
import { listHardwareVendors } from '@/lib/hardware/adapter';

type CourtRow = {
  id: string;
  name: string;
  court_type_id: string | null;
  is_active: boolean | null;
};

type Props = {
  clubId: string;
  initialVendor: HardwareVendor;
  courts: CourtRow[];
};

const VENDOR_LABELS: Record<
  HardwareVendor,
  { name: string; tagline: string; icon: React.ReactNode; bestFor: string; envVar: string }
> = {
  nuki: {
    name: 'Nuki',
    tagline: 'Smart-Lock für Türschlösser',
    icon: <Lock className="h-5 w-5" />,
    bestFor: 'Tür-Management (Lock/Unlock)',
    envVar: 'NUKI_API_TOKEN',
  },
  shelly: {
    name: 'Shelly',
    tagline: 'Smarte Licht-/Heizungs-Steckdosen',
    icon: <Lightbulb className="h-5 w-5" />,
    bestFor: 'Licht + Heizung (setLight on/off)',
    envVar: 'SHELLY_API_HOST',
  },
  loxone: {
    name: 'Loxone',
    tagline: 'Gebäudeautomation (MiniServer)',
    icon: <Cpu className="h-5 w-5" />,
    bestFor: 'Vollständige Gebäude-Automation',
    envVar: 'LOXONE_MINISERVER_IP',
  },
};

export default function SmartCourtClient({ clubId, initialVendor, courts }: Props) {
  const [selectedVendor, setSelectedVendor] = useState<HardwareVendor>(initialVendor);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubId}/hardware-vendor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardware_vendor: selectedVendor }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        previous_vendor?: string | null;
        new_vendor?: HardwareVendor;
        unchanged?: boolean;
        missing_env?: boolean;
        error?: string;
      };

      if (!res.ok) {
        toast.error(`Fehler beim Speichern: ${json.error ?? 'Unbekannter Fehler'}`);
        return;
      }

      if (json.unchanged) {
        toast.info(
          `Bereits auf ${VENDOR_LABELS[selectedVendor].name} konfiguriert — keine Änderung.`
        );
      } else {
        toast.success(
          `Hardware-Vendor aktualisiert: ${json.previous_vendor ?? 'unset'} → ${VENDOR_LABELS[selectedVendor].name}`
        );
      }

      if (json.missing_env) {
        toast.warning(
          `Achtung: ENV-Variable ${VENDOR_LABELS[selectedVendor].envVar} ist auf dem Server nicht gesetzt. Der Booking-Webhook wird Hardware-Calls vorerst nicht ausführen (Auth-Error pro Aufruf).`,
          { duration: 8000 }
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      toast.error(`Netzwerkfehler: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeCourts = courts.filter((c) => c.is_active !== false);
  const didVendorChange = selectedVendor !== initialVendor;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page-Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Smart Court Konfiguration
        </h1>
        <p className="text-muted-foreground">
          Wähle den Hardware-Vendor, der für die Buchungs-Automation (Licht + Tür +
          Heizung) dieses Vereins verwendet wird. Der Booking-Webhook (EPIC 3.1.2)
          liest diesen Vendor-Wert aus <code>clubs.features.hardware_vendor</code>.
        </p>
      </div>

      {/* Vendor-Selection-Card */}
      <Card>
        <CardHeader>
          <CardTitle>Hardware-Vendor</CardTitle>
          <CardDescription>
            Bestimmt, welcher Adapter für Buchung-zu-Hardware-Webhooks (Nuki/Shelly/Loxone)
            verwendet wird. Club-Level-Settings — alle Plätze dieses Vereins nutzen denselben Vendor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="radiogroup"
            aria-label="Hardware-Vendor auswählen"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {listHardwareVendors().map((v) => {
              const meta = VENDOR_LABELS[v];
              const isSelected = selectedVendor === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${meta.name} als Hardware-Vendor auswählen`}
                  onClick={() => setSelectedVendor(v)}
                  className={`text-left rounded-lg border-2 p-4 transition-all hover:border-brand-primary/50 ${
                    isSelected
                      ? 'border-brand-primary bg-brand-primary/5 ring-2 ring-brand-primary/20'
                      : 'border-border'
                  }`}
                  data-testid={`vendor-card-${v}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={isSelected ? 'text-brand-primary' : 'text-muted-foreground'}
                      >
                        {meta.icon}
                      </span>
                      <span className="font-semibold">{meta.name}</span>
                    </div>
                    {isSelected && <Badge variant="default">Aktiv</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{meta.tagline}</p>
                  <p className="mt-2 text-xs text-muted-foreground italic flex items-center gap-1">
                    <InfoIcon className="h-3 w-3 shrink-0" />
                    Optimal für: {meta.bestFor}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Aktuelle Konfiguration:{' '}
              <span className="font-medium text-foreground">
                {VENDOR_LABELS[initialVendor].name}
              </span>
              {didVendorChange && (
                <span className="ml-2 text-brand-primary">
                  (noch nicht gespeichert)
                </span>
              )}
            </p>
            <Button
              onClick={handleSave}
              disabled={isSaving || !didVendorChange}
              data-testid="vendor-save-button"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Speichern
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aktive-Plätze-Read-Only-List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Aktive Plätze ({activeCourts.length} von {courts.length})
          </CardTitle>
          <CardDescription>
            Alle aktiven Plätze verwenden den ausgewählten Hardware-Vendor (Club-Level).
            Per-Court-Override ist in EPIC 3.1.4 verfügbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCourts.length === 0 ? (
            <div className="text-sm text-muted-foreground italic">
              Keine aktiven Plätze angelegt. Bitte zuerst Plätze anlegen unter{' '}
              <a href="/admin/courts" className="underline text-brand-primary">
                /admin/courts
              </a>
              .
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="courts-list">
              {activeCourts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2"
                  data-testid={`court-row-${c.id}`}
                >
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <Badge variant="secondary">{VENDOR_LABELS[selectedVendor].name}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
