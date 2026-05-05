'use client';

import { useState } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreHorizontal, Edit, Trash2, Lightbulb, Power, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Court } from '@/lib/types/court-booking';

interface CourtsManageClientProps {
  initialCourts: Court[];
  courtTypes: Array<{ id: string; name: string; surface: string }>;
  clubId: string;
}

export function CourtsManageClient({ initialCourts, courtTypes, clubId }: CourtsManageClientProps) {
  const [courts, setCourts] = useState<Court[]>(initialCourts);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  // Filter courts
  const filteredCourts = courts.filter((court) => {
    const matchesSearch =
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.number.toString().includes(searchQuery);
    return matchesSearch;
  });

  const resetForm = () => {
    setFormData({
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
    });
  };

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
          clubId: clubId, // for superadmin, but admin will be forced to own club
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Erstellen');
      }

      const data = await res.json();
      setCourts((prev) => [...prev, data.court]);
      setShowCreateDialog(false);
      resetForm();
      toast.success('Platz erfolgreich erstellt');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen';
      toast.error(message);
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
    setShowEditDialog(true);
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
      setShowEditDialog(false);
      setSelectedCourt(null);
      resetForm();
      toast.success('Platz erfolgreich aktualisiert');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Aktualisieren';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCourt) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/courts/${selectedCourt.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Löschen');
      }

      setCourts((prev) => prev.filter((c) => c.id !== selectedCourt.id));
      setShowDeleteDialog(false);
      setSelectedCourt(null);
      toast.success('Platz deaktiviert');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCourtTypeName = (courtTypeId: string) => {
    const ct = courtTypes.find((t) => t.id === courtTypeId);
    return ct ? ct.name : 'Unbekannt';
  };

  const getCourtSurface = (court: Court) => {
    const ct = courtTypes.find((t) => t.id === court.court_type_id);
    return ct?.surface || '';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-brand-primary dark:text-white">
            Platzverwaltung
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400">
            Verwalte Tennisplätze deines Vereins
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Neuer Platz
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Neuen Platz anlegen</DialogTitle>
                <DialogDescription>
                  Erstelle einen neuen Tennisplatz für deinen Verein.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. Platz 1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number">Platznummer *</Label>
                    <Input
                      id="number"
                      type="number"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      placeholder="1"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courtTypeId">Platztyp *</Label>
                  <select
                    id="courtTypeId"
                    value={formData.courtTypeId}
                    onChange={(e) => {
                      const type = courtTypes.find((t) => t.id === e.target.value);
                      setFormData({
                        ...formData,
                        courtTypeId: e.target.value,
                        surface: type?.surface || '',
                      });
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    required
                  >
                    <option value="">Typ wählen...</option>
                    {courtTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({getSurfaceLabel(type.surface)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Standort</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="z.B. Hauptgebäude"
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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasLighting"
                    checked={formData.hasLighting}
                    onChange={(e) => setFormData({ ...formData, hasLighting: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="hasLighting" className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Flutlicht vorhanden
                  </Label>
                </div>
                {formData.hasLighting && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lightingHoursStart">Flutlicht von</Label>
                      <Input
                        id="lightingHoursStart"
                        type="time"
                        value={formData.lightingHoursStart}
                        onChange={(e) =>
                          setFormData({ ...formData, lightingHoursStart: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lightingHoursEnd">Flutlicht bis</Label>
                      <Input
                        id="lightingHoursEnd"
                        type="time"
                        value={formData.lightingHoursEnd}
                        onChange={(e) =>
                          setFormData({ ...formData, lightingHoursEnd: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isActive" className="flex items-center gap-2">
                    <Power className="h-4 w-4" />
                    Aktiv
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Wird erstellt...' : 'Erstellen'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Suche nach Platzname oder Nummer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Courts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Nr.</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Belag</TableHead>
                <TableHead>Flutlicht</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCourts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Keine Plätze gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filteredCourts.map((court) => (
                  <TableRow key={court.id}>
                    <TableCell className="font-medium">{court.name}</TableCell>
                    <TableCell>{court.number}</TableCell>
                    <TableCell>{getCourtTypeName(court.court_type_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getSurfaceLabel(getCourtSurface(court))}</Badge>
                    </TableCell>
                    <TableCell>
                      {court.has_lighting ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Lightbulb className="h-4 w-4" /> Ja
                        </span>
                      ) : (
                        <span className="text-gray-400">Nein</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={court.is_active ? 'default' : 'secondary'}
                        className={
                          court.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }
                      >
                        {court.is_active ? 'Aktiv' : 'Inaktiv'}
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
                          <DropdownMenuItem onClick={() => handleEdit(court)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setSelectedCourt(court);
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

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Platz bearbeiten</DialogTitle>
              <DialogDescription>Ändere die Details des Tennisplatzes.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="edit-number">Platznummer *</Label>
                  <Input
                    id="edit-number"
                    type="number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-courtTypeId">Platztyp *</Label>
                <select
                  id="edit-courtTypeId"
                  value={formData.courtTypeId}
                  onChange={(e) => {
                    const type = courtTypes.find((t) => t.id === e.target.value);
                    setFormData({
                      ...formData,
                      courtTypeId: e.target.value,
                      surface: type?.surface || '',
                    });
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  required
                >
                  {courtTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({getSurfaceLabel(type.surface)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Standort</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-hasLighting"
                  checked={formData.hasLighting}
                  onChange={(e) => setFormData({ ...formData, hasLighting: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-hasLighting" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  Flutlicht
                </Label>
              </div>
              {formData.hasLighting && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-lightingHoursStart">von</Label>
                    <Input
                      id="edit-lightingHoursStart"
                      type="time"
                      value={formData.lightingHoursStart}
                      onChange={(e) =>
                        setFormData({ ...formData, lightingHoursStart: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lightingHoursEnd">bis</Label>
                    <Input
                      id="edit-lightingHoursEnd"
                      type="time"
                      value={formData.lightingHoursEnd}
                      onChange={(e) =>
                        setFormData({ ...formData, lightingHoursEnd: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-isActive" className="flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Aktiv
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Platz deaktivieren</DialogTitle>
            <DialogDescription>
              Möchtest du den Platz &quot;{selectedCourt?.name}&quot; wirklich deaktivieren? Dies
              kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Wird deaktiviert...' : 'Deaktivieren'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
