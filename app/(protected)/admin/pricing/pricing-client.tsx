'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CenteredModal } from '@/components/ui/centered-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import {
  Plus,
  Edit,
  Trash2,
  Clock,
  Calendar,
  DollarSign,
  Loader2,
  Sun,
} from 'lucide-react';

// Types
interface TimeRange {
  start: string;
  end: string;
  priceMultiplier: number;
}

interface PricingRule {
  id: string;
  clubId: string;
  courtId?: string;
  ruleType: string;
  name?: string;
  description?: string;
  minBookingHours: number;
  maxBookingHours: number;
  pricePerHour: number;
  advanceBookingDays: number;
  appliesToMemberTypes: string[];
  appliesToGroups: string[];
  timeRanges: TimeRange[];
  daysOfWeek?: number[];
  seasonId?: string;
  validFrom?: string;
  validUntil?: string;
  priority: number;
  isActive: boolean;
}

interface CourtOption {
  id: string;
  name: string;
}

interface SeasonOption {
  id: string;
  name: string;
  season_type: string;
  year: number;
}

const DAY_LABELS: Record<number, string> = {
  0: 'So',
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
};

const RULE_TYPE_LABELS: Record<string, string> = {
  hourly: 'Stundensatz',
  member: 'Mitglied',
  trial: 'Probetraining',
  group: 'Gruppe',
  season: 'Saison',
};

const RULE_TYPE_COLORS: Record<string, string> = {
  hourly: 'bg-blue-100 text-blue-800',
  member: 'bg-green-100 text-green-800',
  trial: 'bg-yellow-100 text-yellow-800',
  group: 'bg-purple-100 text-purple-800',
  season: 'bg-orange-100 text-orange-800',
};

const emptyForm = {
  ruleType: 'hourly' as const,
  name: '',
  description: '',
  courtId: '',
  pricePerHour: 15,
  minBookingHours: 1,
  maxBookingHours: 4,
  advanceBookingDays: 7,
  appliesToMemberTypes: [] as string[],
  appliesToGroups: [] as string[],
  timeRanges: [] as TimeRange[],
  daysOfWeek: undefined as number[] | undefined,
  seasonId: '',
  priority: 0,
  isActive: true,
};

const defaultTimeRanges: TimeRange[] = [
  { start: '08:00', end: '17:00', priceMultiplier: 1.0 },
  { start: '17:00', end: '22:00', priceMultiplier: 1.5 },
];

interface PricingClientProps {
  clubId: string;
}

export function PricingClient({ clubId }: PricingClientProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState<'create' | 'edit' | null>(null);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Reference data
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);

  // Load pricing rules
  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/pricing-rules?clubId=${clubId}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setRules(data.pricingRules || []);
    } catch {
      toast.error('Fehler beim Laden der Preisregeln');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  // Load reference data
  const loadRefData = useCallback(async () => {
    try {
      const [courtsRes, seasonsRes] = await Promise.all([
        apiFetch(`/api/courts?clubId=${clubId}`),
        apiFetch(`/api/seasons?clubId=${clubId}&limit=20`),
      ]);
      if (courtsRes.ok) {
        const d = await courtsRes.json();
        setCourts(d.courts || []);
      }
      if (seasonsRes.ok) {
        const d = await seasonsRes.json();
        setSeasons(d.seasons || []);
      }
    } catch {
      // silent
    }
  }, [clubId]);

  useEffect(() => {
    loadRules();
    loadRefData();
  }, [loadRules, loadRefData]);

  const resetForm = () => setForm(emptyForm);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clubId,
          courtId: form.courtId || null,
          ruleType: form.ruleType,
          name: form.name || undefined,
          description: form.description || undefined,
          minBookingHours: form.minBookingHours,
          maxBookingHours: form.maxBookingHours,
          pricePerHour: form.pricePerHour,
          advanceBookingDays: form.advanceBookingDays,
          appliesToMemberTypes: form.appliesToMemberTypes,
          appliesToGroups: form.appliesToGroups,
          timeRanges: form.timeRanges,
          daysOfWeek: form.daysOfWeek,
          seasonId: form.seasonId || null,
          priority: form.priority,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }
      toast.success('Preisregel erstellt');
      setShowForm(null);
      resetForm();
      await loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/pricing-rules/${selectedRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleType: form.ruleType,
          name: form.name || undefined,
          description: form.description || undefined,
          minBookingHours: form.minBookingHours,
          maxBookingHours: form.maxBookingHours,
          pricePerHour: form.pricePerHour,
          advanceBookingDays: form.advanceBookingDays,
          appliesToMemberTypes: form.appliesToMemberTypes,
          appliesToGroups: form.appliesToGroups,
          timeRanges: form.timeRanges,
          daysOfWeek: form.daysOfWeek,
          seasonId: form.seasonId || null,
          priority: form.priority,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }
      toast.success('Preisregel aktualisiert');
      setShowForm(null);
      setSelectedRule(null);
      resetForm();
      await loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRule) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/pricing-rules/${selectedRule.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      toast.success('Preisregel gelöscht');
      setShowDelete(false);
      setSelectedRule(null);
      await loadRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (rule: PricingRule) => {
    setSelectedRule(rule);
    setForm({
      ruleType: rule.ruleType as typeof form.ruleType,
      name: rule.name || '',
      description: rule.description || '',
      courtId: rule.courtId || '',
      pricePerHour: rule.pricePerHour,
      minBookingHours: rule.minBookingHours,
      maxBookingHours: rule.maxBookingHours,
      advanceBookingDays: rule.advanceBookingDays,
      appliesToMemberTypes: rule.appliesToMemberTypes,
      appliesToGroups: rule.appliesToGroups,
      timeRanges: rule.timeRanges,
      daysOfWeek: rule.daysOfWeek,
      seasonId: rule.seasonId || '',
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setShowForm('edit');
  };

  const toggleDay = (day: number) => {
    const current = form.daysOfWeek || [];
    if (current.includes(day)) {
      setForm({ ...form, daysOfWeek: current.filter((d) => d !== day) });
    } else {
      setForm({ ...form, daysOfWeek: [...current, day].sort() });
    }
  };

  const addTimeRange = () => {
    setForm({
      ...form,
      timeRanges: [...form.timeRanges, { start: '08:00', end: '17:00', priceMultiplier: 1.0 }],
    });
  };

  const removeTimeRange = (idx: number) => {
    setForm({
      ...form,
      timeRanges: form.timeRanges.filter((_, i) => i !== idx),
    });
  };

  const updateTimeRange = (idx: number, field: keyof TimeRange, value: string | number) => {
    const updated = [...form.timeRanges];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, timeRanges: updated });
  };

  const addDefaultTimeRanges = () => {
    setForm({ ...form, timeRanges: defaultTimeRanges });
  };

  const renderFormFields = () => (
    <div className="grid gap-4 py-4">
      {/* Name & Description */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pr-name">Name</Label>
          <Input
            id="pr-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z.B. Peak-Time Aufschlag"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pr-type">Regeltyp</Label>
          <Select
            value={form.ruleType}
            onValueChange={(v) => setForm({ ...form, ruleType: v as typeof form.ruleType })}
          >
            <SelectTrigger id="pr-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pr-desc">Beschreibung</Label>
        <Input
          id="pr-desc"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional"
        />
      </div>

      {/* Price & Hours */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pr-price">Preis pro Stunde (€) *</Label>
          <Input
            id="pr-price"
            type="number"
            step="0.5"
            min="0"
            value={form.pricePerHour}
            onChange={(e) => setForm({ ...form, pricePerHour: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pr-minhours">Min. Stunden</Label>
          <Input
            id="pr-minhours"
            type="number"
            min="0"
            step="0.5"
            value={form.minBookingHours}
            onChange={(e) => setForm({ ...form, minBookingHours: parseFloat(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pr-maxhours">Max. Stunden</Label>
          <Input
            id="pr-maxhours"
            type="number"
            min="0"
            step="0.5"
            value={form.maxBookingHours}
            onChange={(e) => setForm({ ...form, maxBookingHours: parseFloat(e.target.value) || 4 })}
          />
        </div>
      </div>

      {/* Court & Season */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pr-court">Platz (optional)</Label>
          <Select
            value={form.courtId}
            onValueChange={(v) => setForm({ ...form, courtId: v === '_all' ? '' : v })}
          >
            <SelectTrigger id="pr-court">
              <SelectValue placeholder="Alle Plätze" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Alle Plätze</SelectItem>
              {courts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pr-season">Saison (optional)</Label>
          <Select
            value={form.seasonId}
            onValueChange={(v) => setForm({ ...form, seasonId: v === '_none' ? '' : v })}
          >
            <SelectTrigger id="pr-season">
              <SelectValue placeholder="Keine Saisonbindung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Keine Saisonbindung</SelectItem>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.season_type} {s.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Days of Week */}
      <div className="space-y-2">
        <Label>Tage</Label>
        <div className="flex gap-1.5 flex-wrap">
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                (form.daysOfWeek || []).includes(day)
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-muted text-muted-foreground border-border hover:border-brand-primary/30'
              )}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Keine Auswahl = gilt für alle Tage</p>
      </div>

      {/* Time Ranges (Dynamic Pricing) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Zeitbasierte Preisstufen</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addDefaultTimeRanges}>
              Standard (Peak/Off-Peak)
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addTimeRange}>
              <Plus className="h-3 w-3 mr-1" /> Stufe
            </Button>
          </div>
        </div>
        {form.timeRanges.length === 0 && (
          <p className="text-sm text-muted-foreground italic">
            Keine Zeitstufen — es gilt der Basispreis für alle Zeiten.
          </p>
        )}
        {form.timeRanges.map((tr, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={tr.start}
                onChange={(e) => updateTimeRange(idx, 'start', e.target.value)}
                className="w-32 h-9 text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="time"
                value={tr.end}
                onChange={(e) => updateTimeRange(idx, 'end', e.target.value)}
                className="w-32 h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={tr.priceMultiplier}
                onChange={(e) =>
                  updateTimeRange(idx, 'priceMultiplier', parseFloat(e.target.value) || 1)
                }
                className="w-20 h-9 text-sm"
                placeholder="x"
              />
              <span className="text-xs text-muted-foreground">× Basispreis</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500"
              onClick={() => removeTimeRange(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Priority & Active */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pr-priority">Priorität</Label>
          <Input
            id="pr-priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 pt-8">
          <input
            type="checkbox"
            id="pr-active"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          <Label htmlFor="pr-active" className="cursor-pointer">Aktiv</Label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary dark:text-white">
            Dynamische Preisgestaltung
          </h1>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground">
            Zeitbasierte Preise, Saison-Aufschläge und Tagespreise für Plätze
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            resetForm();
            setShowForm('create');
          }}
        >
          <Plus className="h-4 w-4" />
          Neue Preisregel
        </Button>
      </div>

      {/* Explanation Cards */}
      {!showForm && rules.length === 0 && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
            <CardContent className="p-4">
              <Clock className="h-8 w-8 text-blue-600 mb-2" />
              <h3 className="font-semibold text-sm">Zeitbasierte Preise</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Definiere Peak- und Off-Peak-Zeiten mit unterschiedlichen Multiplikatoren.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
            <CardContent className="p-4">
              <Calendar className="h-8 w-8 text-green-600 mb-2" />
              <h3 className="font-semibold text-sm">Tagespreise</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Lege unterschiedliche Preise für Wochentage und Wochenenden fest.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
            <CardContent className="p-4">
              <Sun className="h-8 w-8 text-orange-600 mb-2" />
              <h3 className="font-semibold text-sm">Saison-Preise</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Binde Preise an Sommer- oder Wintersaison für automatische Übergänge.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        </div>
      )}

      {/* Rules List */}
      {!loading && rules.length > 0 && !showForm && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Preis/h</TableHead>
                  <TableHead>Zeitstufen</TableHead>
                  <TableHead>Tage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={cn(!rule.isActive && 'opacity-50')}
                  >
                    <TableCell>
                      <span className="font-medium">{rule.name || 'Unbenannt'}</span>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {rule.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          RULE_TYPE_COLORS[rule.ruleType] || 'bg-muted'
                        )}
                      >
                        {RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rule.pricePerHour.toFixed(2)} €
                    </TableCell>
                    <TableCell>
                      {rule.timeRanges && rule.timeRanges.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rule.timeRanges.map((tr, i) => (
                            <Badge key={i} variant="secondary" className="text-xs gap-1">
                              {tr.start}–{tr.end}
                              {tr.priceMultiplier !== 1 && (
                                <span className="text-brand-primary font-semibold">
                                  ×{tr.priceMultiplier}
                                </span>
                              )}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ganztägig</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rule.daysOfWeek && rule.daysOfWeek.length > 0 ? (
                        <div className="flex gap-0.5">
                          {rule.daysOfWeek.map((d) => (
                            <Badge key={d} variant="outline" className="text-xs px-1.5">
                              {DAY_LABELS[d]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Alle</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={rule.isActive ? 'default' : 'secondary'}
                        className={cn(
                          'text-xs',
                          rule.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-muted'
                        )}
                      >
                        {rule.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => {
                            setSelectedRule(rule);
                            setShowDelete(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <CenteredModal
        open={showForm !== null}
        onClose={() => {
          setShowForm(null);
          setSelectedRule(null);
          resetForm();
        }}
      >
        <form onSubmit={showForm === 'create' ? handleCreate : handleUpdate}>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">
              {showForm === 'create' ? 'Neue Preisregel' : 'Preisregel bearbeiten'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {showForm === 'create'
                ? 'Erstelle eine zeitbasierte Preisregel für Platzbuchungen.'
                : 'Passe die Preisregel an.'}
            </p>
          </div>
          {renderFormFields()}
          <div className="flex gap-2 pt-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(null);
                setSelectedRule(null);
                resetForm();
              }}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Wird gespeichert...'
                : showForm === 'create'
                  ? 'Erstellen'
                  : 'Speichern'}
            </Button>
          </div>
        </form>
      </CenteredModal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Preisregel löschen"
        description={`Möchtest du die Preisregel "${selectedRule?.name || 'Unbenannt'}" wirklich löschen?`}
        confirmLabel={submitting ? 'Wird gelöscht…' : 'Löschen'}
        variant="danger"
        loading={submitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
