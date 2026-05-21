'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSurfaceLabel } from '@/lib/court-calendar-utils';
import type { Court } from '@/lib/types/court-booking';

interface CourtsManageClientProps {
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  clubId: string;
}

type ViewMode = 'grid' | 'list';

const SURFACE_COLORS: Record<string, string> = {
  clay: 'bg-orange-100 text-orange-800 border-orange-200',
  hard: 'bg-blue-100 text-blue-800 border-blue-200',
  grass: 'bg-green-100 text-green-800 border-green-200',
  carpet: 'bg-purple-100 text-purple-800 border-purple-200',
  artificial_grass: 'bg-teal-100 text-teal-800 border-teal-200',
};

function getSurfaceColorClass(surface: string) {
  return SURFACE_COLORS[surface] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  // Filter courts
  const filteredCourts = courts.filter((court) => {
    if (!searchQuery) return true;
    return (
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.number.toString().includes(searchQuery)
    );
  });

  const resetForm = () => setFormData(emptyForm);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/courts', {
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
      number: court.number.toString(),
      courtTypeId: court.court_type_id,
      surface: courtType?.surface || '',
      hasLighting: court.has_lighting,
      lightingHoursStart: court.lighting_hours_start || '',
      lightingHoursEnd: court.lighting_hours_end || '',
      location: court.location || '',
      description: court.description || '',
      isActive: court.is_active,
    });
    setShowInlineForm('edit');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/courts/${selectedCourt.id}`, {
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
      const res = await fetch(`/api/courts/${court.id}`, {
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
      const res = await fetch(`/api/courts/${selectedCourt.id}`, {
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

  // Reusable court form fields
  const CourtFormFields = () => (
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
          <SelectTrigger>
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
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Flutlicht vorhanden
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="flex items-center gap-2 text-sm font-medium">
            <Power className="h-4 w-4 text-green-500" />
            Platz aktiv
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

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary dark:text-white">
            Platzverwaltung
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
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
        <Card className="border-brandPrimary/20 shadow-md animate-in">
          <CardHeader className="border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-brandPrimary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleCloseForm} className="shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <CardTitle>
                    {showInlineForm === 'create' ? 'Neuen Platz anlegen' : `Platz bearbeiten`}
                  </CardTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
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
              <CourtFormFields />
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'rounded-none px-3',
                  viewMode === 'grid' && 'bg-gray-100 dark:bg-gray-800'
                )}
                onClick={() => setViewMode('grid')}
                aria-label="Rasteransicht"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'rounded-none px-3',
                  viewMode === 'list' && 'bg-gray-100 dark:bg-gray-800'
                )}
                onClick={() => setViewMode('list')}
                aria-label="Listenansicht"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Empty state */}
          {filteredCourts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-light/10 mb-5">
                <MapPin className="h-10 w-10 text-brand-light" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {searchQuery ? 'Keine Plätze gefunden' : 'Noch keine Plätze'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
                {searchQuery
                  ? `Keine Plätze für "${searchQuery}" gefunden`
                  : 'Erstelle deine ersten Spielflächen um Buchungen zu ermöglichen'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    resetForm();
                    setShowInlineForm('create');
                  }}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-brand-light hover:bg-brand-light/80 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Platz anlegen
                </button>
              )}
            </div>
          )}

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
                              className="text-red-600"
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                            <Lightbulb className="h-3 w-3" />
                            Flutlicht
                          </span>
                        )}
                      </div>
                      {court.location && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{court.location}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          {court.is_active ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span
                            className={cn(
                              'text-xs font-medium',
                              court.is_active ? 'text-green-600' : 'text-gray-400'
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
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-gray-400" />
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
                          <TableCell className="text-sm text-gray-500">
                            {court.location || '—'}
                          </TableCell>
                          <TableCell>
                            {court.has_lighting ? (
                              <span className="flex items-center gap-1 text-yellow-600 text-sm">
                                <Lightbulb className="h-4 w-4" /> Ja
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">Nein</span>
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
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

      {/* Deactivate Confirmation Dialog */}
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
