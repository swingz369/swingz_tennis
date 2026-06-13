'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, Plus, X, Check, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface FeeConfig {
  id: string;
  name: string;
  type: string;
  amount: number;
  billing_cycle: string;
  is_active: boolean;
}

export default function FeeCategoriesClient({
  clubId: _clubId,
  initialCategories,
}: {
  clubId: string;
  initialCategories: FeeConfig[];
}) {
  const [categories, setCategories] = useState<FeeConfig[]>(initialCategories);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'training',
    amount: 0,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'training',
    amount: 0,
    billing_cycle: 'one_time',
    is_active: true,
  });

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch('/api/fee-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          amount: form.amount,
          billingCycle: 'one_time',
        }),
      });
      if (res.ok) {
        const { feeConfiguration } = await res.json();
        const mapped: FeeConfig = {
          id: feeConfiguration.id,
          name: feeConfiguration.name,
          type: feeConfiguration.type,
          amount: feeConfiguration.amount,
          billing_cycle: feeConfiguration.billingCycle,
          is_active: feeConfiguration.isActive ?? true,
        };
        setCategories((prev) => [...prev, mapped]);
        setCreating(false);
        setForm({ name: '', type: 'training', amount: 0 });
        toast.success('Kategorie erstellt');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erstellung fehlgeschlagen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: FeeConfig) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      type: cat.type,
      amount: cat.amount,
      billing_cycle: cat.billing_cycle,
      is_active: cat.is_active,
    });
  };

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/fee-configurations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          type: editForm.type,
          amount: editForm.amount,
          billingCycle: editForm.billing_cycle,
          isActive: editForm.is_active,
        }),
      });
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  name: editForm.name,
                  type: editForm.type,
                  amount: editForm.amount,
                  billing_cycle: editForm.billing_cycle,
                  is_active: editForm.is_active,
                }
              : c
          )
        );
        setEditingId(null);
        toast.success('Kategorie aktualisiert');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Aktualisierung fehlgeschlagen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Kategorie "${name}" wirklich löschen?`)) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/fee-configurations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success('Kategorie gelöscht');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Löschen fehlgeschlagen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Preiskategorien</h1>
        <Button onClick={() => setCreating(true)} disabled={creating}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Kategorie
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="z.B. Erwachsene, Jugend, Familienbeitrag"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-type">Typ</Label>
              <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger id="new-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="membership">Mitgliedschaft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-amount">Preis (€)</Label>
              <Input
                id="new-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount || ''}
                onChange={(e) =>
                  setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Speichern
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
                Abbrechen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Kategorien</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Kategorien angelegt.</p>
          ) : (
            <div className="divide-y">
              {categories.map((cat) => (
                <div key={cat.id} className="py-3">
                  {editingId === cat.id ? (
                    /* ── Edit mode ── */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor={`edit-name-${cat.id}`}>Name</Label>
                          <Input
                            id={`edit-name-${cat.id}`}
                            value={editForm.name}
                            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-type-${cat.id}`}>Typ</Label>
                          <Select
                            value={editForm.type}
                            onValueChange={(v) => setEditForm((p) => ({ ...p, type: v }))}
                          >
                            <SelectTrigger id={`edit-type-${cat.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="training">Training</SelectItem>
                              <SelectItem value="membership">Mitgliedschaft</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-amount-${cat.id}`}>Preis (€)</Label>
                          <Input
                            id={`edit-amount-${cat.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.amount || ''}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                amount: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-cycle-${cat.id}`}>Zyklus</Label>
                          <Select
                            value={editForm.billing_cycle}
                            onValueChange={(v) => setEditForm((p) => ({ ...p, billing_cycle: v }))}
                          >
                            <SelectTrigger id={`edit-cycle-${cat.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monatlich</SelectItem>
                              <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                              <SelectItem value="yearly">Jährlich</SelectItem>
                              <SelectItem value="one_time">Einmalig</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleUpdate(cat.id)} disabled={saving}>
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Check className="h-3.5 w-3.5 mr-1" />
                          )}
                          Speichern
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Abbrechen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat.type === 'training' ? 'Training' : 'Mitgliedschaft'} ·{' '}
                          {cat.amount.toFixed(2)} € ·{' '}
                          {cat.billing_cycle === 'yearly'
                            ? 'Jährlich'
                            : cat.billing_cycle === 'monthly'
                              ? 'Monatlich'
                              : cat.billing_cycle === 'quarterly'
                                ? 'Vierteljährlich'
                                : 'Einmalig'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            cat.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {cat.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(cat)}
                          aria-label={`${cat.name} bearbeiten`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          disabled={deletingId === cat.id}
                          aria-label={`${cat.name} löschen`}
                        >
                          {deletingId === cat.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
