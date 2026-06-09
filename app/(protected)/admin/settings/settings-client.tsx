'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings, Building2, Zap, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { ModuleSelectionStep } from '@/components/onboarding/module-selection-step';
import { SeasonPlanningTab } from './season-planning-tab';

type OpeningHours = {
  monday: { open: string; close: string };
  tuesday: { open: string; close: string };
  wednesday: { open: string; close: string };
  thursday: { open: string; close: string };
  friday: { open: string; close: string };
  saturday: { open: string; close: string };
  sunday: { open: string; close: string };
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
  defaultHourlyRate?: number;
  status: 'active' | 'inactive' | 'suspended';
  openingHours: OpeningHours;
  bundesland?: string;
  billing_unit_minutes?: 45 | 60;
  tax_rate?: number;
  default_payment_method?: 'sepa' | 'transfer' | 'cash' | 'stripe';
  invoice_number_prefix?: string;
};

type SystemSettings = {
  appName: string;
  emailNotifications: boolean;
  reminderDaysBefore: number;
  stripePublicKey: string;
};

export default function SettingsClient() {
  const [activeTab, setActiveTab] = useState<'club' | 'system' | 'modules' | 'planning'>('club');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Club settings state
  const [clubSettings, setClubSettings] = useState<ClubSettings>({
    id: '',
    name: '',
    maxMembers: 100,
    status: 'active',
    openingHours: {
      monday: { open: '09:00', close: '22:00' },
      tuesday: { open: '09:00', close: '22:00' },
      wednesday: { open: '09:00', close: '22:00' },
      thursday: { open: '09:00', close: '22:00' },
      friday: { open: '09:00', close: '22:00' },
      saturday: { open: '09:00', close: '22:00' },
      sunday: { open: '09:00', close: '22:00' },
    },
    billing_unit_minutes: 60,
    tax_rate: 0,
    default_payment_method: 'transfer',
    invoice_number_prefix: '',
  });

  // System settings state (superadmin only)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    appName: 'SWINGZ',
    emailNotifications: true,
    reminderDaysBefore: 1,
    stripePublicKey: '',
  });

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Fetch user club
      const clubRes = await apiFetch('/api/user/club');
      if (clubRes.ok) {
        const clubData = await clubRes.json();
        setClubSettings((prev) => ({
          ...prev,
          id: clubData.clubId,
          name: clubData.club.name || '',
          maxMembers: clubData.club.maxMembers || 100,
          defaultHourlyRate: clubData.club.defaultHourlyRate || 15.0,
          status: clubData.club.status || 'active',
          ...(clubData.club.bundesland != null ? { bundesland: clubData.club.bundesland } : {}),
          billing_unit_minutes: clubData.club.billing_unit_minutes === 45 ? 45 : 60,
          tax_rate: clubData.club.tax_rate ?? 0,
          default_payment_method: (['sepa', 'transfer', 'cash', 'stripe'] as const).includes(
            clubData.club.default_payment_method
          )
            ? clubData.club.default_payment_method
            : 'transfer',
          invoice_number_prefix: clubData.club.invoice_number_prefix ?? '',
        }));
      }

      // Check if user is superadmin (via roles API)
      try {
        const rolesRes = await apiFetch('/api/user/roles');
        if (rolesRes.ok) {
          const { roles } = await rolesRes.json();
          if (roles?.includes('superadmin')) {
            setIsSuperAdmin(true);
          }
        }
      } catch {
        // Non-critical: superadmin tab stays hidden on error
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      toast.error('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClubSettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/clubs/${clubSettings.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clubSettings.name,
          maxMembers: clubSettings.maxMembers,
          defaultHourlyRate: clubSettings.defaultHourlyRate,
          openingHours: clubSettings.openingHours,
          status: clubSettings.status,
          bundesland: clubSettings.bundesland,
          billing_unit_minutes: clubSettings.billing_unit_minutes,
          tax_rate: clubSettings.tax_rate,
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
      console.error('Failed to save club settings:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

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
      console.error('Failed to save system settings:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Vereinseinstellungen</h1>
        <p className="text-muted-foreground">Grundlegende Konfiguration deines Vereins</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('club')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'club'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Verein
          </div>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('system')}
            className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'system'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </div>
          </button>
        )}
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'modules'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Module
          </div>
        </button>
        <button
          onClick={() => setActiveTab('planning')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'planning'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Saisonplanung
          </div>
        </button>
      </div>

      {/* Club Settings Tab */}
      {activeTab === 'club' && (
        <Card>
          <CardHeader>
            <CardTitle>Vereinseinstellungen</CardTitle>
            <CardDescription>Grundlegende Informationen zu deinem Verein</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <Label htmlFor="maxMembers">Maximale Mitgliederzahl</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  value={clubSettings.maxMembers}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setClubSettings((prev) => ({ ...prev, maxMembers: val }));
                  }}
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={clubSettings.status}
                onValueChange={(value: 'active' | 'inactive' | 'suspended') =>
                  setClubSettings({ ...clubSettings, status: value })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Status wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="suspended">Suspendiert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pricing */}
            <div>
              <Label htmlFor="defaultHourlyRate">Stundenpreis (€)</Label>
              <Input
                id="defaultHourlyRate"
                type="number"
                step="0.5"
                min="0"
                value={clubSettings.defaultHourlyRate || 15}
                onChange={(e) =>
                  setClubSettings({
                    ...clubSettings,
                    defaultHourlyRate: parseFloat(e.target.value) || 15.0,
                  })
                }
                className="w-48"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Standard-Stundenpreis für Platzbuchungen
              </p>
            </div>

            {/* Opening Hours */}
            <div>
              <Label className="text-base font-semibold">Öffnungszeiten</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {(
                  [
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                  ] as const
                ).map((day) => (
                  <div key={day} className="flex items-center gap-2">
                    <div className="w-28 capitalize">{day}</div>
                    <Input
                      type="time"
                      value={clubSettings.openingHours[day].open}
                      onChange={(e) =>
                        setClubSettings({
                          ...clubSettings,
                          openingHours: {
                            ...clubSettings.openingHours,
                            [day]: { ...clubSettings.openingHours[day], open: e.target.value },
                          },
                        })
                      }
                      className="w-32"
                    />
                    <span>-</span>
                    <Input
                      type="time"
                      value={clubSettings.openingHours[day].close}
                      onChange={(e) =>
                        setClubSettings({
                          ...clubSettings,
                          openingHours: {
                            ...clubSettings.openingHours,
                            [day]: { ...clubSettings.openingHours[day], close: e.target.value },
                          },
                        })
                      }
                      className="w-32"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Configuration */}
            <div>
              <Label className="text-base font-semibold">Abrechnungskonfiguration</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <Label htmlFor="bundesland">Bundesland</Label>
                  <Select
                    value={clubSettings.bundesland ?? ''}
                    onValueChange={(value) =>
                      setClubSettings({ ...clubSettings, bundesland: value })
                    }
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
                    placeholder="0 für gemeinnützige e.V."
                    className="w-48"
                  />
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
                    placeholder="z.B. RE-2025-"
                    className="w-48"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSaveClubSettings} disabled={saving}>
                {saving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Module Settings Tab */}
      {activeTab === 'modules' && (
        <Card>
          <CardHeader>
            <CardTitle>Modul-Auswahl</CardTitle>
            <CardDescription>
              Aktiviere oder deaktiviere optionale Bereiche deines Vereins. Grundfunktionen
              (Mitgliederverwaltung, Trainer, Saisonplanung, Finanzen) sind immer aktiv.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModuleSelectionStep clubId={clubSettings.id} showContinue />
          </CardContent>
        </Card>
      )}

      {/* Season Planning Tab */}
      {activeTab === 'planning' && <SeasonPlanningTab />}

      {/* System Settings Tab (Superadmin only) */}
      {activeTab === 'system' && (
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

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="emailNotifications"
                checked={systemSettings.emailNotifications}
                onChange={(e) =>
                  setSystemSettings({ ...systemSettings, emailNotifications: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="emailNotifications">E-Mail-Benachrichtigungen aktivieren</Label>
            </div>

            <div>
              <Label htmlFor="reminderDays">Erinnerung Tage vorher (Buchungen)</Label>
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
            </div>

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

            <div className="flex justify-end">
              <Button onClick={handleSaveSystemSettings} disabled={saving}>
                {saving ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
