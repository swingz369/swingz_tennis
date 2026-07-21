'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Lightbulb,
  Power,
  Search,
  LayoutGrid,
  List,
  MapPin,
  Hash,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  Sun,
  DollarSign,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';
import type { Court } from '@/lib/types/court-booking';
import { CenteredModal } from '@/components/ui/centered-modal';
import { NoCourtsBrandedEmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api-fetch';

interface CourtType {
  id: string;
  name: string;
  description?: string;
  surface_type: 'clay' | 'hard' | 'grass' | 'carpet' | 'artificial_grass';
  is_indoor: boolean;
  is_outdoor: boolean;
  requires_lighting: boolean;
  max_players: number;
  hourly_rate: number;
  is_active: boolean;
}

interface CourtsManageClientProps {
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  clubId: string;
}

type ViewMode = 'grid' | 'list';

const SURFACE_COLORS: Record<string, string> = {
  clay: 'bg-brand-accent-100 text-brand-accent-800 border-brand-accent-200 dark:bg-brand-accent-900/20 dark:text-brand-accent-300 dark:border-brand-accent-800/40',
  hard: 'bg-info-100 text-info-800 border-info-200 dark:bg-info-900/20 dark:text-info-300 dark:border-info-800/40',
  grass:
    'bg-success-100 text-success-800 border-success-200 dark:bg-success-900/20 dark:text-success-300 dark:border-success-800/40',
  carpet:
    'bg-info-100 text-info-800 border-info-200 dark:bg-info-900/20 dark:text-info-300 dark:border-info-800/40',
  artificial_grass:
    'bg-info-100 text-info-800 border-info-200 dark:bg-info-900/20 dark:text-info-300 dark:border-info-800/40',
};

function getSurfaceColorClass(surface: string) {
  return SURFACE_COLORS[surface] || 'bg-muted text-foreground border-border';
}

const emptyForm = {
  name: '',
  number: '',
  courtTypeId: '',
  surface: '',
  hasLighting: false,
  lightingHoursStart: '',
  lightingHoursEnd: '',
  location: '',
  description: '',
  isActive: true,
  usableForTraining: true,
};

export function CourtsManageClient({ initialCourts, courtTypes, clubId }: CourtsManageClientProps) {
  const [courts, setCourts] = useState<Court[]>(initialCourts);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showInlineForm, setShowInlineForm] = useState<'create' | 'edit' | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  // ── Court Types State ──
  const [courtTypesList, setCourtTypesList] = useState<CourtType[]>([]);
  const [showCourtTypes, setShowCourtTypes] = useState(false);
  const [courtTypesLoading, setCourtTypesLoading] = useState(false);
  const [showCTCreate, setShowCTCreate] = useState(false);
  const [showCTEdit, setShowCTEdit] = useState(false);
  const [showCTDelete, setShowCTDelete] = useState(false);
  const [selectedCT, setSelectedCT] = useState<CourtType | null>(null);
  const [ctSubmitting, setCtSubmitting] = useState(false);
  const [ctForm, setCtForm] = useState({
    name: '',
    description: '',
    surface_type: 'hard' as CourtType['surface_type'],
    is_indoor: false,
    is_outdoor: true,
    requires_lighting: false,
    max_players: 4,
    hourly_rate: 0,
    is_active: true,
  });

  const loadCourtTypes = useCallback(async () => {
    setCourtTypesLoading(true);
    try {
      const res = await apiFetch('/api/court-types?limit=100');
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      setCourtTypesList(data.courtTypes ?? []);
    } catch {
      toast.error('Fehler beim Laden der Platz-Typen');
    } finally {
      setCourtTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCourtTypes && courtTypesList.length === 0 && !courtTypesLoading) {
      loadCourtTypes();
    }
  }, [showCourtTypes, courtTypesList.length, courtTypesLoading, loadCourtTypes]);

  const resetCTForm = () => {
    setCtForm({
      name: '',
      description: '',
      surface_type: 'hard',
      is_indoor: false,
      is_outdoor: true,
      requires_lighting: false,
      max_players: 4,
      hourly_rate: 0,
      is_active: true,
    });
  };

  const handleCTCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCtSubmitting(true);
    try {
      const res = await apiFetch('/api/court-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }
      toast.success('Platz-Typ erfolgreich erstellt');
      setShowCTCreate(false);
      resetCTForm();
      await loadCourtTypes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setCtSubmitting(false);
    }
  };

  const handleCTEdit = (type: CourtType) => {
    setSelectedCT(type);
    setCtForm({
      name: type.name,
      description: type.description || '',
      surface_type: type.surface_type,
      is_indoor: type.is_indoor,
      is_outdoor: type.is_outdoor,
      requires_lighting: type.requires_lighting,
      max_players: type.max_players,
      hourly_rate: type.hourly_rate,
      is_active: type.is_active,
    });
    setShowCTEdit(true);
  };

  const handleCTUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCT) return;
    setCtSubmitting(true);
    try {
      const res = await apiFetch(`/api/court-types/${selectedCT.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ctForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }
      toast.success('Platz-Typ erfolgreich aktualisiert');
      setShowCTEdit(false);
      setSelectedCT(null);
      resetCTForm();
      await loadCourtTypes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    } finally {
      setCtSubmitting(false);
    }
  };

  const handleCTDelete = async () => {
    if (!selectedCT) return;
    setCtSubmitting(true);
    try {
      const res = await apiFetch(`/api/court-types/${selectedCT.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Löschen');
      }
      toast.success('Platz-Typ deaktiviert');
      setShowCTDelete(false);
      setSelectedCT(null);
      await loadCourtTypes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Löschen');
    } finally {
      setCtSubmitting(false);
    }
  };

  // Filter courts
  const filteredCourts = courts.filter((court) => {
    if (!searchQuery) return true;
    return (
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.number?.toString().includes(searchQuery)
    );
  });

  const resetForm = () => setFormData(emptyForm);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/courts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          number: parseInt(formData.number),
          courtTypeId: formData.courtTypeId,
          surface: formData.surface,
          hasLighting: formData.hasLighting,
          lightingHoursStart: formData.lightingHoursStart || null,
          lightingHoursEnd: formData.lightingHoursEnd || null,
          location: formData.location || null,
          description: formData.description || null,
          isActive: formData.isActive,
          usableForTraining: formData.usableForTraining,
          clubId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }

      const data = await res.json();
      setCourts((prev) => [...prev, data.court]);
      setShowInlineForm(null);
      resetForm();
      toast.success('Platz erfolgreich erstellt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (court: Court) => {
    setSelectedCourt(court);
    const courtType = courtTypes.find((ct) => ct.id === court.court_type_id);
    setFormData({
      name: court.name,
      number: court.number?.toString() ?? '',
      courtTypeId: court.court_type_id,
      surface: courtType?.surface || '',
      hasLighting: court.has_lighting,
      lightingHoursStart: court.lighting_hours_start || '',
      lightingHoursEnd: court.lighting_hours_end || '',
      location: court.location || '',
      description: court.description || '',
      isActive: court.is_active,
      usableForTraining: court.usable_for_training,
    });
    setShowInlineForm('edit');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/courts/${selectedCourt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          number: parseInt(formData.number),
          courtTypeId: formData.courtTypeId,
          surface: formData.surface,
          hasLighting: formData.hasLighting,
          lightingHoursStart: formData.lightingHoursStart || null,
          lightingHoursEnd: formData.lightingHoursEnd || null,
          location: formData.location || null,
          description: formData.description || null,
          isActive: formData.isActive,
          usableForTraining: formData.usableForTraining,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }

      const data = await res.json();
      setCourts((prev) => prev.map((c) => (c.id === selectedCourt.id ? data.court : c)));
      setShowInlineForm(null);
      setSelectedCourt(null);
      resetForm();
      toast.success('Platz erfolgreich aktualisiert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (court: Court) => {
    setTogglingId(court.id);
    try {
      const res = await apiFetch(`/api/courts/${court.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !court.is_active }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }

      const data = await res.json();
      setCourts((prev) => prev.map((c) => (c.id === court.id ? data.court : c)));
      toast.success(
        data.court.is_active ? `${court.name} wurde aktiviert` : `${court.name} wurde deaktiviert`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Statuswechsel');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedCourt) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/courts/${selectedCourt.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Deaktivieren');
      }

      setCourts((prev) => prev.filter((c) => c.id !== selectedCourt.id));
      setShowDeleteDialog(false);
      setSelectedCourt(null);
      toast.success('Platz deaktiviert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Deaktivieren');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCourtSurface = (court: Court) => {
    const ct = courtTypes.find((t) => t.id === court.court_type_id);
    return (court.surface as string) || ct?.surface || '';
  };

  const getCourtTypeName = (courtTypeId: string) => {
    const ct = courtTypes.find((t) => t.id === courtTypeId);
    return ct ? ct.name : 'Unbekannt';
  };

  const handleCloseForm = () => {
    setShowInlineForm(null);
    setSelectedCourt(null);
    resetForm();
  };

  // Reusable court form fields (render function, not a component)
  const renderCourtFormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="form-name">Name *</Label>
          <Input
            id="form-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="z.B. Platz 1"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-number">Platznummer *</Label>
          <Input
            id="form-number"
            type="number"
            min="1"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="1"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="form-courtTypeId">Platztyp *</Label>
        <Select
          value={formData.courtTypeId}
          onValueChange={(v) => {
            const type = courtTypes.find((t) => t.id === v);
            setFormData({ ...formData, courtTypeId: v, surface: type?.surface || '' });
          }}
        >
          <SelectTrigger id="form-courtTypeId">
            <SelectValue placeholder="Typ wählen..." />
          </SelectTrigger>
          <SelectContent>
            {courtTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name} ({getSurfaceLabel(type.surface)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="form-location">Standort</Label>
          <Input
            id="form-location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="z.B. Hauptgebäude"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-description">Beschreibung</Label>
          <Input
            id="form-description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.hasLighting}
            onChange={(e) => setFormData({ ...formData, hasLighting: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-warning-500" />
            Flutlicht vorhanden
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <Power className="h-4 w-4 text-success-500" />
            Platz aktiv
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.usableForTraining}
            onChange={(e) => setFormData({ ...formData, usableForTraining: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <GraduationCap className="h-4 w-4 text-brand-primary" />
            Für Trainingsplanung nutzen
          </span>
        </label>
      </div>
      {formData.hasLighting && (
        <div className="grid grid-cols-2 gap-4 pl-7">
          <div className="space-y-2">
            <Label htmlFor="form-lightingStart">Flutlicht von</Label>
            <Input
              id="form-lightingStart"
              type="time"
              value={formData.lightingHoursStart}
              onChange={(e) => setFormData({ ...formData, lightingHoursStart: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="form-lightingEnd">Flutlicht bis</Label>
            <Input
              id="form-lightingEnd"
              type="time"
              value={formData.lightingHoursEnd}
              onChange={(e) => setFormData({ ...formData, lightingHoursEnd: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );

  // Reusable court type form fields (render function, not a component)
  const renderCourtTypeFormFields = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ct-name">Name *</Label>
          <Input
            id="ct-name"
            value={ctForm.name}
            onChange={(e) => setCtForm({ ...ctForm, name: e.target.value })}
            placeholder="z.B. Sandplatz"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ct-surface">Belag *</Label>
          <Select
            value={ctForm.surface_type}
            onValueChange={(v) =>
              setCtForm({ ...ctForm, surface_type: v as CourtType['surface_type'] })
            }
          >
            <SelectTrigger id="ct-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clay">Sand (Clay)</SelectItem>
              <SelectItem value="hard">Hartplatz (Hard)</SelectItem>
              <SelectItem value="grass">Rasen (Grass)</SelectItem>
              <SelectItem value="carpet">Teppich (Carpet)</SelectItem>
              <SelectItem value="artificial_grass">Kunstrasen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ct-description">Beschreibung</Label>
        <Input
          id="ct-description"
          value={ctForm.description}
          onChange={(e) => setCtForm({ ...ctForm, description: e.target.value })}
          placeholder="Optionale Beschreibung"
        />
      </div>
      <div className="flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ctForm.is_indoor}
            onChange={(e) => setCtForm({ ...ctForm, is_indoor: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <Label className="cursor-pointer">Halle</Label>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ctForm.is_outdoor}
            onChange={(e) => setCtForm({ ...ctForm, is_outdoor: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <Label className="cursor-pointer">Freiluft</Label>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={ctForm.requires_lighting}
            onChange={(e) => setCtForm({ ...ctForm, requires_lighting: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          <Label className="flex items-center gap-1 cursor-pointer">
            <Lightbulb className="h-4 w-4" /> Flutlicht
          </Label>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ct-max-players">Max. Spieler</Label>
          <Input
            id="ct-max-players"
            type="number"
            min="1"
            max="10"
            value={ctForm.max_players}
            onChange={(e) => setCtForm({ ...ctForm, max_players: parseInt(e.target.value) || 4 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ct-hourly-rate">Std-Preis (€)</Label>
          <Input
            id="ct-hourly-rate"
            type="number"
            step="0.5"
            min="0"
            value={ctForm.hourly_rate}
            onChange={(e) => setCtForm({ ...ctForm, hourly_rate: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={ctForm.is_active}
          onChange={(e) => setCtForm({ ...ctForm, is_active: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        <Label className="cursor-pointer">Aktiv</Label>
      </label>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Plätze & Typen</h2>
          <p className="text-sm text-muted-foreground">
            {courts.length} {courts.length === 1 ? 'Platz' : 'Plätze'} ·{' '}
            {courts.filter((c) => c.is_active).length} aktiv
          </p>
        </div>
        {!showInlineForm && (
          <Button
            className="gap-2"
            onClick={() => {
              resetForm();
              setShowInlineForm('create');
            }}
          >
            <Plus className="h-4 w-4" />
            Neuer Platz
          </Button>
        )}
      </div>

      {/* Inline Create/Edit Form */}
      {showInlineForm && (
        <Card className="animate-in">
          <CardHeader className="border-b border-border dark:border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleCloseForm} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <CardTitle>
                    {showInlineForm === 'create' ? 'Neuen Platz anlegen' : `Platz bearbeiten`}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">
                    {showInlineForm === 'create'
                      ? 'Erstelle einen neuen Tennisplatz für deinen Verein.'
                      : `Ändere die Details von "${selectedCourt?.name}".`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseForm}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={showInlineForm === 'create' ? handleCreate : handleUpdate}>
              {renderCourtFormFields()}
              <div className="flex gap-3 pt-4 border-t border-border dark:border-white/10">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? 'Wird gespeichert...'
                    : showInlineForm === 'create'
                      ? 'Platz erstellen'
                      : 'Speichern'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search & View Toggle (hidden during inline form) */}
      {!showInlineForm && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Suche nach Platzname oder Nummer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn('rounded-none px-3', viewMode === 'grid' && 'bg-muted dark:bg-muted')}
                onClick={() => setViewMode('grid')}
                aria-label="Rasteransicht"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn('rounded-none px-3', viewMode === 'list' && 'bg-muted dark:bg-muted')}
                onClick={() => setViewMode('list')}
                aria-label="Listenansicht"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {filteredCourts.length === 0 &&
            (searchQuery ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-light/10 mb-5">
                  <MapPin className="h-10 w-10 text-brand-light" />
                </div>
                <h3 className="text-xl font-semibold text-foreground dark:text-white">
                  Keine Plätze gefunden
                </h3>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2 max-w-xs">
                  Keine Plätze für &quot;{searchQuery}&quot; gefunden
                </p>
              </div>
            ) : (
              <NoCourtsBrandedEmptyState
                onCreate={() => {
                  resetForm();
                  setShowInlineForm('create');
                }}
              />
            ))}

          {/* Grid view */}
          {viewMode === 'grid' && filteredCourts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCourts.map((court) => {
                const surface = getCourtSurface(court);
                const surfaceColorClass = getSurfaceColorClass(surface);
                return (
                  <Card
                    key={court.id}
                    className={cn(
                      'relative transition-all hover:shadow-md',
                      !court.is_active && 'opacity-60'
                    )}
                  >
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                            {court.number}
                          </div>
                          <CardTitle className="text-base font-semibold truncate">
                            {court.name}
                          </CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(court)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-error-600"
                              onClick={() => {
                                setSelectedCourt(court);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Deaktivieren
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                            surfaceColorClass
                          )}
                        >
                          {getSurfaceLabel(surface) || getCourtTypeName(court.court_type_id)}
                        </span>
                        {court.has_lighting && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-700 border border-warning-200 dark:bg-warning-900/20 dark:text-warning-300 dark:border-warning-800/40">
                            <Lightbulb className="h-3 w-3" />
                            Flutlicht
                          </span>
                        )}
                        {court.usable_for_training && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-light/15 text-brand-light border border-brand-light/40">
                            <GraduationCap className="h-3 w-3" />
                            Training
                          </span>
                        )}
                      </div>
                      {court.location && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{court.location}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {court.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-success-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span
                            className={cn(
                              'text-xs font-medium',
                              court.is_active ? 'text-success-600' : 'text-muted-foreground'
                            )}
                          >
                            {court.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleToggleActive(court)}
                          disabled={togglingId === court.id}
                          aria-label={court.is_active ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {togglingId === court.id ? (
                            <span className="text-xs">...</span>
                          ) : court.is_active ? (
                            <ToggleRight className="h-4 w-4 text-success-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && filteredCourts.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <Hash className="h-3.5 w-3.5" />
                          Nr.
                        </div>
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ / Belag</TableHead>
                      <TableHead>Standort</TableHead>
                      <TableHead>Flutlicht</TableHead>
                      <TableHead>Training</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourts.map((court) => {
                      const surface = getCourtSurface(court);
                      return (
                        <TableRow key={court.id} className={!court.is_active ? 'opacity-60' : ''}>
                          <TableCell className="font-medium tabular-nums">{court.number}</TableCell>
                          <TableCell className="font-medium">{court.name}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                                getSurfaceColorClass(surface)
                              )}
                            >
                              {getSurfaceLabel(surface) || getCourtTypeName(court.court_type_id)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {court.location || '—'}
                          </TableCell>
                          <TableCell>
                            {court.has_lighting ? (
                              <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400 text-sm">
                                <Lightbulb className="h-4 w-4" /> Ja
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Nein</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {court.usable_for_training ? (
                              <span className="flex items-center gap-1 text-brand-light text-sm">
                                <GraduationCap className="h-4 w-4" /> Ja
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Nein</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleToggleActive(court)}
                              disabled={togglingId === court.id}
                              className="flex items-center gap-1.5 group"
                              aria-label={court.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            >
                              <Badge
                                variant={court.is_active ? 'default' : 'secondary'}
                                className={cn(
                                  'text-xs transition-colors',
                                  court.is_active
                                    ? 'bg-success-100 text-success-700 hover:bg-success-200 dark:bg-success-900/20 dark:text-success-300 dark:hover:bg-success-900/30'
                                    : 'bg-muted text-muted-foreground hover:bg-muted'
                                )}
                              >
                                {togglingId === court.id
                                  ? '...'
                                  : court.is_active
                                    ? 'Aktiv'
                                    : 'Inaktiv'}
                              </Badge>
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(court)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Bearbeiten
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggleActive(court)}
                                  disabled={togglingId === court.id}
                                >
                                  <Power className="h-4 w-4 mr-2" />
                                  {court.is_active ? 'Deaktivieren' : 'Aktivieren'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Court Types Section ── */}
      {!showInlineForm && (
        <Card className="mt-2">
          <button
            onClick={() => setShowCourtTypes(!showCourtTypes)}
            className="w-full flex items-center justify-between px-4 md:px-6 py-4 text-left hover:bg-muted/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10">
                <MapPin className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Platztypen verwalten</h2>
                <p className="text-xs text-muted-foreground">
                  {courtTypesList.length} Typ{courtTypesList.length !== 1 ? 'en' : ''} · Beläge,
                  Ausstattung & Preise
                </p>
              </div>
            </div>
            {showCourtTypes ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          {showCourtTypes && (
            <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div />
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    resetCTForm();
                    setShowCTCreate(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Neuer Typ
                </Button>
              </div>

              {courtTypesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-light" />
                </div>
              ) : courtTypesList.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Noch keine Platz-Typen angelegt.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {courtTypesList.map((type) => (
                    <Card
                      key={type.id}
                      className={cn(
                        'relative transition-all hover:shadow-sm',
                        !type.is_active && 'opacity-60'
                      )}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold truncate">{type.name}</h3>
                            {type.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {type.description}
                              </p>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCTEdit(type)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-error-600"
                                onClick={() => {
                                  setSelectedCT(type);
                                  setShowCTDelete(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Deaktivieren
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {getSurfaceLabel(type.surface_type)}
                          </Badge>
                          {type.is_indoor && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Users className="h-3 w-3" /> Halle
                            </Badge>
                          )}
                          {type.is_outdoor && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Sun className="h-3 w-3" /> Freiluft
                            </Badge>
                          )}
                          {type.requires_lighting && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 text-warning-600 dark:text-warning-400"
                            >
                              <Lightbulb className="h-3 w-3" /> Flutlicht
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {type.max_players} Spieler
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" /> {type.hourly_rate.toFixed(2)} €/h
                          </span>
                          <Badge
                            variant={type.is_active ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs',
                              type.is_active
                                ? 'bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-300'
                                : 'bg-muted text-foreground'
                            )}
                          >
                            {type.is_active ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Court Type Create Dialog */}
      <CenteredModal open={showCTCreate} onClose={() => setShowCTCreate(false)}>
        <form onSubmit={handleCTCreate}>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Neuen Platz-Typ anlegen</h2>
            <p className="text-sm text-muted-foreground">
              Definiere einen neuen Platz-Typ mit Belag und Preiseinstellungen.
            </p>
          </div>
          {renderCourtTypeFormFields()}
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowCTCreate(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={ctSubmitting}>
              {ctSubmitting ? 'Wird erstellt...' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </CenteredModal>

      {/* Court Type Edit Dialog */}
      <CenteredModal open={showCTEdit} onClose={() => setShowCTEdit(false)}>
        <form onSubmit={handleCTUpdate}>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Platz-Typ bearbeiten</h2>
            <p className="text-sm text-muted-foreground">Ändere die Details des Platz-Typs.</p>
          </div>
          {renderCourtTypeFormFields()}
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowCTEdit(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={ctSubmitting}>
              {ctSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </CenteredModal>

      {/* Court Type Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showCTDelete}
        onOpenChange={setShowCTDelete}
        title="Platz-Typ deaktivieren"
        description={`Möchtest du den Platz-Typ "${selectedCT?.name}" wirklich deaktivieren? Bestehende Plätze mit diesem Typ bleiben erhalten.`}
        confirmLabel={ctSubmitting ? 'Wird deaktiviert…' : 'Deaktivieren'}
        variant="danger"
        loading={ctSubmitting}
        onConfirm={handleCTDelete}
      />

      {/* Deactivate Court Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Platz deaktivieren"
        description={`Möchtest du "${selectedCourt?.name}" deaktivieren? Der Platz bleibt erhalten, ist aber nicht mehr buchbar.`}
        confirmLabel={isSubmitting ? 'Wird deaktiviert…' : 'Deaktivieren'}
        variant="danger"
        loading={isSubmitting}
        onConfirm={handleDeactivate}
      />
    </div>
  );
}
