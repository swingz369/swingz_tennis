'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Database,
  Edit3,
  Loader2,
  Save,
  X as XIcon,
  Info,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

export interface EditableSetting {
  id: string;
  category: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  is_required: boolean;
  validation: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
}

/**
 * SettingsEditorClient — Editierbare globale system_settings (club_id IS NULL).
 *
 * Wichtige Abgrenzung: Service-Status (Stripe/Resend) und rein statische
 * Werte wie Preismodell/E-Mail-Absender sind ENV-Var-getrieben und werden NICHT
 * via UI editiert. Diese Seite ist die Brücke zwischen Migration-Deploy und
 * Live-Konfiguration für die Owner-relevanten Einstellungen (z. B. decision_quorum).
 *
 * is_required-Settings werden vom Server abgelehnt (422) — wir rendern sie
 * daher garnicht erst als editierbar.
 */
export function SettingsEditorClient({ settings }: { settings: EditableSetting[] }) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editable = settings.filter((s) => !s.is_required);
  const lockedRo = settings.filter((s) => s.is_required);

  if (editable.length === 0 && lockedRo.length === 0) {
    return null;
  }

  const startEdit = (s: EditableSetting) => {
    setEditingKey(s.key);
    // Bei boolean → "true"/"false"; bei number → direkt; bei json → roher string
    setDraft(s.type === 'boolean' ? s.value : s.value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraft('');
  };

  const saveEdit = async (s: EditableSetting) => {
    setBusyKey(s.key);
    try {
      // JSON-Werte werden als String durchgereicht; number/boolean werden geparst.
      let parsedValue: string | number | boolean = draft;
      if (s.type === 'number') {
        const n = Number(draft);
        if (!Number.isFinite(n)) {
          toast.error('Wert muss eine Zahl sein');
          return;
        }
        parsedValue = n;
      } else if (s.type === 'boolean') {
        if (draft !== 'true' && draft !== 'false') {
          toast.error('Wert muss "true" oder "false" sein');
          return;
        }
        parsedValue = draft === 'true';
      }

      const res = await apiFetch(`/api/owner/system-settings/${encodeURIComponent(s.key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: parsedValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info('Wert ist bereits aktuell.');
      } else if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Speichern fehlgeschlagen.');
        return;
      } else {
        toast.success(`"${s.key}" aktualisiert.`);
      }
      cancelEdit();
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Netzwerkfehler.');
    } finally {
      setBusyKey(null);
    }
  };

  const grouped = editable.reduce<Record<string, EditableSetting[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Diagnostic-Disclaimer */}
      <div
        role="status"
        className="rounded-xl border border-info-200 bg-info-50 p-4 flex items-start gap-3"
      >
        <Info className="h-5 w-5 text-info-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-info-900">
            Plattform-Einstellungen — Mischbetrieb aus ENV-Vars und DB-Settings
          </p>
          <p className="text-info-800 mt-1">
            Werte wie <span className="font-mono">STRIPE_SECRET_KEY</span>, E-Mail-Absender und das
            Preismodell sind über Vercel-ENV-Vars und das Stripe-Dashboard gepflegt — bitte dort
            ändern. Nur die unten gelisteten globalen{' '}
            <span className="font-mono">system_settings</span>-Einträge können direkt aus dieser
            Oberfläche bearbeitet werden. Änderungen werden im Audit-Log festgehalten.
          </p>
        </div>
      </div>

      {/* Editierbare DB-Settings */}
      {editable.length > 0 && (
        <section
          aria-label="Editierbare globale DB-Einstellungen"
          className="rounded-xl border border-border dark:border-white/10 bg-card p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Globale DB-Einstellungen ({editable.length})</h3>
          </div>
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">{category}</p>
                <div className="space-y-2">
                  {items.map((s) => {
                    const isEditing = editingKey === s.key;
                    const busy = busyKey === s.key;
                    return (
                      <div
                        key={s.id}
                        className="rounded-md border border-border dark:border-white/10 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono font-semibold">{s.key}</span>
                              <Badge variant="outline" className="text-2xs">
                                {s.type}
                              </Badge>
                            </div>
                            {s.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {s.description}
                              </p>
                            )}
                            {s.validation.enum?.length ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Optionen: {s.validation.enum.join(' · ')}
                              </p>
                            ) : null}
                            {(s.validation.min !== undefined || s.validation.max !== undefined) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Bereich: {s.validation.min ?? '−∞'} … {s.validation.max ?? '+∞'}
                              </p>
                            )}
                          </div>
                          {!isEditing && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7"
                              onClick={() => startEdit(s)}
                            >
                              <Edit3 className="h-3 w-3" />
                              Bearbeiten
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-2">
                            {s.type === 'boolean' ? (
                              <select
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : s.type === 'json' ? (
                              <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="w-full min-h-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono"
                                aria-label={`Neuer JSON-Wert für ${s.key}`}
                                placeholder='Beispiel: {"key": "value"}'
                              />
                            ) : (
                              <input
                                type={s.type === 'number' ? 'number' : 'text'}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                aria-label={`Neuer Wert für ${s.key}`}
                              />
                            )}
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-xs h-7"
                                disabled={busy}
                                onClick={cancelEdit}
                              >
                                <XIcon className="h-3 w-3" />
                                Abbrechen
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1 text-xs h-7"
                                disabled={busy}
                                onClick={() => saveEdit(s)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3" />
                                )}
                                Speichern
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs max-w-full truncate"
                            >
                              {s.value}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* is_required-Settings (hardcoded im Code oder Migration — read-only) */}
      {lockedRo.length > 0 && (
        <section
          aria-label="Read-only DB-Einstellungen"
          className="rounded-xl border border-border dark:border-white/10 bg-card p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-warning-600" />
            <h3 className="text-sm font-semibold">
              Gesperrte DB-Einstellungen ({lockedRo.length})
            </h3>
          </div>
          <div className="rounded-md border border-warning-200 bg-warning-50 p-3 flex items-start gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-warning-600 shrink-0 mt-0.5" />
            <p className="text-xs text-warning-800">
              Diese Werte sind als <code className="font-mono">is_required</code> markiert und
              werden per Migration / ENV-Var gepflegt. Eine Änderung würde Application-Logik
              gefährden.
            </p>
          </div>
          <div className="space-y-2">
            {lockedRo.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 px-2 border-b border-border last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-sm font-mono font-semibold">{s.key}</span>
                  {s.description && (
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  )}
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {s.value}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
