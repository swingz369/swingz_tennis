'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CenteredModal } from '@/components/ui/centered-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  Lightbulb,
  DollarSign,
  Sun,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaginationNav } from '@/components/ui/pagination-nav';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

export interface CourtType {
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
  created_at?: string;
  updated_at?: string;
}

const TYPES_PER_PAGE = 20;

export function CourtTypesClient() {
  const [courtTypes, setCourtTypes] = useState<CourtType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedType, setSelectedType] = useState<CourtType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
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

  // Load court types with server-side pagination
  const loadCourtTypes = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/court-types?page=${p}&limit=${TYPES_PER_PAGE}`);
      if (!res.ok) {
        throw new Error('Failed to load court types');
      }
      const data = await res.json();
      setCourtTypes(data.courtTypes ?? []);
      setPagination(data.pagination ?? null);
    } catch (error) {
      console.error('Failed to load court types:', error);
      toast.error('Fehler beim Laden der Platz-Typen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourtTypes(page);
  }, [loadCourtTypes, page]);

  const resetForm = () => {
    setFormData({
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/court-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }

      toast.success('Platz-Typ erfolgreich erstellt');
      setShowCreateDialog(false);
      resetForm();
      loadCourtTypes(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (type: CourtType) => {
    setSelectedType(type);
    setFormData({
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
    setShowEditDialog(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/court-types/${selectedType.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Aktualisieren');
      }

      toast.success('Platz-Typ erfolgreich aktualisiert');
      setShowEditDialog(false);
      setSelectedType(null);
      resetForm();
      loadCourtTypes(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/court-types/${selectedType.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Löschen');
      }

      toast.success('Platz-Typ deaktiviert');
      setShowDeleteDialog(false);
      setSelectedType(null);
      if (courtTypes.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadCourtTypes(page);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSurfaceLabel = (surface: string) => {
    const labels: Record<string, string> = {
      clay: 'Sand',
      hard: 'Hartplatz',
      grass: 'Rasen',
      carpet: 'Teppich',
      artificial_grass: 'Kunstrasen',
    };
    return labels[surface] || surface;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <PageHeader
        title="Platz-Typen verwalten"
        description="Definiere verfügbare Platzarten (Belag, Ausstattung, Preise)"
        breadcrumbs={[{ label: 'Platz-Typen' }]}
        actions={[
          { label: 'Neuer Platz-Typ', icon: Plus, onClick: () => setShowCreateDialog(true) },
        ]}
      />

      {/* Court Types Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Belag</TableHead>
                <TableHead>Ausstattung</TableHead>
                <TableHead>Max. Spieler</TableHead>
                <TableHead>Std-Preis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-light mx-auto" />
                  </TableCell>
                </TableRow>
              ) : courtTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Keine Platz-Typen gefunden
                  </TableCell>
                </TableRow>
              ) : (
                courtTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getSurfaceLabel(type.surface_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        {type.is_indoor && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> Halle
                          </span>
                        )}
                        {type.is_outdoor && (
                          <span className="flex items-center gap-1">
                            <Sun className="h-3 w-3" /> Freiluft
                          </span>
                        )}
                        {type.requires_lighting && (
                          <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400">
                            <Lightbulb className="h-3 w-3" /> Flutlicht
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{type.max_players}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {type.hourly_rate.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={type.is_active ? 'default' : 'secondary'}
                        className={
                          type.is_active
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-300'
                            : 'bg-muted text-foreground'
                        }
                      >
                        {type.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(type)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-error-600"
                            onClick={() => {
                              setSelectedType(type);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deaktivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && <PaginationNav meta={pagination} compact onPageChange={setPage} />}

      {/* Create Dialog */}
      <CenteredModal open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <form onSubmit={handleCreate}>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Neuen Platz-Typ anlegen</h2>
            <p className="text-sm text-muted-foreground">
              Definiere einen neuen Tennisplatz-Typ mit Belag und Preiseinstellungen.
            </p>
          </div>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="z.B. Sandplatz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optionale Beschreibung"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surface_type">Belag *</Label>
              <Select
                value={formData.surface_type}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    surface_type: v as CourtType['surface_type'],
                  })
                }
              >
                <SelectTrigger>
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
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_indoor"
                  checked={formData.is_indoor}
                  onChange={(e) => setFormData({ ...formData, is_indoor: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="is_indoor">Halle</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_outdoor"
                  checked={formData.is_outdoor}
                  onChange={(e) => setFormData({ ...formData, is_outdoor: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="is_outdoor">Freiluft</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requires_lighting"
                  checked={formData.requires_lighting}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_lighting: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="requires_lighting" className="flex items-center gap-1">
                  <Lightbulb className="h-4 w-4" />
                  Flutlicht
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_players">Max. Spieler</Label>
                <Input
                  id="max_players"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_players}
                  onChange={(e) =>
                    setFormData({ ...formData, max_players: parseInt(e.target.value) || 4 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">Std-Preis (€)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="is_active">Aktiv</Label>
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird erstellt...' : 'Erstellen'}
            </Button>
          </div>
        </form>
      </CenteredModal>

      {/* Edit Dialog */}
      <CenteredModal open={showEditDialog} onClose={() => setShowEditDialog(false)}>
        <form onSubmit={handleUpdate}>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">Platz-Typ bearbeiten</h2>
            <p className="text-sm text-muted-foreground">Ändere die Details des Platz-Typs.</p>
          </div>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Beschreibung</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-surface_type">Belag *</Label>
              <Select
                value={formData.surface_type}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    surface_type: v as CourtType['surface_type'],
                  })
                }
              >
                <SelectTrigger>
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
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is_indoor"
                  checked={formData.is_indoor}
                  onChange={(e) => setFormData({ ...formData, is_indoor: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="edit-is_indoor">Halle</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-is_outdoor"
                  checked={formData.is_outdoor}
                  onChange={(e) => setFormData({ ...formData, is_outdoor: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="edit-is_outdoor">Freiluft</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-requires_lighting"
                  checked={formData.requires_lighting}
                  onChange={(e) =>
                    setFormData({ ...formData, requires_lighting: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="edit-requires_lighting" className="flex items-center gap-1">
                  <Lightbulb className="h-4 w-4" />
                  Flutlicht
                </Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max_players">Max. Spieler</Label>
                <Input
                  id="edit-max_players"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.max_players}
                  onChange={(e) =>
                    setFormData({ ...formData, max_players: parseInt(e.target.value) || 4 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-hourly_rate">Std-Preis (€)</Label>
                <Input
                  id="edit-hourly_rate"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) =>
                    setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="edit-is_active">Aktiv</Label>
            </div>
          </div>
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </CenteredModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Platz-Typ deaktivieren"
        description={`Möchtest du den Platz-Typ "${selectedType?.name}" wirklich deaktivieren? Bestehende Plätze mit diesem Typ bleiben erhalten.`}
        confirmLabel={isSubmitting ? 'Wird deaktiviert…' : 'Deaktivieren'}
        variant="danger"
        loading={isSubmitting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
