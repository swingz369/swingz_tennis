'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Euro, Loader2, Percent, Receipt, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { extractErrorMessage } from '@/lib/typed-helpers';
import type { SeasonBillingConfig } from '@/application/services/season-billing.service';

/**
 * Abrechnung einer Saison: Stundensatz, Umsatzsteuer, Zahlungsziel,
 * Mitgliedsbeitrag.
 *
 * Stand vorher eingeklappt in Schritt 1 des Planungs-Wizards, wo es nichts zu
 * suchen hatte — mit dem Clustering hat es nichts zu tun. Eine globale Preis-
 * Seite ist aber auch der falsche Ort: die Werte hängen an genau einer Saison
 * (`/api/seasons/:id/billing`). Deshalb hier, auf den Saison-Einstellungen.
 * Die Vorschau in Schritt 4 des Wizards liest dieselben Werte und verlinkt
 * hierher, wenn nichts hinterlegt ist.
 */
export function SeasonBillingSettings({ seasonId }: { seasonId: string }) {
  const [config, setConfig] = useState<Partial<SeasonBillingConfig>>({
    trainer_hourly_rate: 50,
    use_trainer_profile_rate: false,
    include_membership_fee: true,
    membership_fee_amount: null,
    membership_fee_type: 'yearly',
    payment_terms_days: 30,
    tax_rate: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/seasons/${seasonId}/billing`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.config) setConfig((prev) => ({ ...prev, ...data.config }));
      })
      .catch(() => {
        // Voreinstellungen behalten, wenn nichts hinterlegt ist
      });
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/seasons/${seasonId}/billing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Abrechnungseinstellungen gespeichert');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(extractErrorMessage(err) ?? 'Fehler beim Speichern');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }, [seasonId, config]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Abrechnung
            </CardTitle>
            <CardDescription>
              Stundensatz, Mitgliedsbeitrag und Zahlungsziel für diese Saison
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Speichern
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="billing-trainer-hourly-rate"
              className="text-xs text-muted-foreground flex items-center gap-1"
            >
              <Euro className="h-3 w-3" />
              Trainer-Stundensatz (€)
            </Label>
            <Input
              id="billing-trainer-hourly-rate"
              type="number"
              min={0}
              step={1}
              value={config.trainer_hourly_rate ?? 50}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  trainer_hourly_rate: parseFloat(e.target.value) || 0,
                }))
              }
              className="h-9"
            />
            <p className="text-2xs text-muted-foreground">Standard-Stundensatz für alle Trainer</p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="billing-tax-rate"
              className="text-xs text-muted-foreground flex items-center gap-1"
            >
              <Percent className="h-3 w-3" />
              Umsatzsteuer (%)
            </Label>
            <Input
              id="billing-tax-rate"
              type="number"
              min={0}
              max={100}
              step={1}
              value={config.tax_rate ?? 0}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, tax_rate: parseInt(e.target.value) || 0 }))
              }
              className="h-9"
            />
            <p className="text-2xs text-muted-foreground">0 = steuerbefreit (Kleinunternehmer)</p>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="billing-payment-terms"
              className="text-xs text-muted-foreground flex items-center gap-1"
            >
              <CalendarDays className="h-3 w-3" />
              Zahlungsziel (Tage)
            </Label>
            <Input
              id="billing-payment-terms"
              type="number"
              min={0}
              max={90}
              step={1}
              value={config.payment_terms_days ?? 30}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  payment_terms_days: parseInt(e.target.value) || 0,
                }))
              }
              className="h-9"
            />
            <p className="text-2xs text-muted-foreground">
              Tage bis zur Fälligkeit nach Rechnungsstellung
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.use_trainer_profile_rate ?? false}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, use_trainer_profile_rate: e.target.checked }))
              }
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Trainer-Profil-Stundensätze verwenden</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.include_membership_fee ?? true}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, include_membership_fee: e.target.checked }))
              }
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Mitgliedsbeitrag einbeziehen</span>
          </label>
        </div>

        {config.include_membership_fee && (
          <div className="grid gap-4 md:grid-cols-3 mt-4 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="space-y-1.5">
              <Label htmlFor="billing-membership-amount" className="text-xs text-muted-foreground">
                Mitgliedsbeitrag (€)
              </Label>
              <Input
                id="billing-membership-amount"
                type="number"
                min={0}
                step={1}
                placeholder="Leer = automatisch aus Beitragskategorien"
                value={config.membership_fee_amount ?? ''}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    membership_fee_amount: e.target.value ? parseFloat(e.target.value) : null,
                  }))
                }
                className="h-9"
              />
              <p className="text-2xs text-muted-foreground">
                Leer lassen für Auto-Erkennung aus Beitragskategorien
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="billing-membership-type" className="text-xs text-muted-foreground">
                Beitragstyp
              </Label>
              <Select
                value={config.membership_fee_type ?? 'yearly'}
                onValueChange={(v) =>
                  setConfig((prev) => ({
                    ...prev,
                    membership_fee_type: v as SeasonBillingConfig['membership_fee_type'],
                  }))
                }
              >
                <SelectTrigger id="billing-membership-type" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yearly">Jährlich</SelectItem>
                  <SelectItem value="seasonal">Saisonal</SelectItem>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Bestimmt die Beschreibung auf der Rechnung
              </p>
            </div>

            <div className="flex items-end">
              <p className="text-xs text-muted-foreground pb-2">
                {config.membership_fee_amount != null
                  ? `Manuell: ${config.membership_fee_amount.toFixed(2)} €`
                  : 'Auto: Betrag aus Beitragskategorien'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
