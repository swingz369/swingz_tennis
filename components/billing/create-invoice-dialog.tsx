'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import { Plus, Trash2, Search } from 'lucide-react';
import { addDays } from 'date-fns';
import { apiFetch } from '@/lib/api-fetch';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  itemType: 'membership_fee' | 'training_fee' | 'court_fee' | 'dunning_fee' | 'other';
}

interface CreateInvoiceDialogProps {
  onSuccess?: () => void;
  members: { id: string; name: string; email: string; role?: string }[];
}

export default function CreateInvoiceDialog({ onSuccess, members }: CreateInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  // Close search dropdown when clicking outside
  const handleSearchBlur = () => {
    // Small delay to allow button clicks inside dropdown to register
    setTimeout(() => setMemberSearchOpen(false), 150);
  };
  const filteredMembers = members.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });
  const [dueDate, setDueDate] = useState(addDays(new Date(), 14).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 19,
      itemType: 'other',
    },
  ]);

  const addItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 19,
        itemType: 'other',
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const calculateTax = () => {
    return items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100),
      0
    );
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async () => {
    if (!memberId) {
      toast.error('Bitte wählen Sie ein Mitglied aus');
      return;
    }

    const validItems = items.filter((item) => item.description && item.unitPrice > 0);

    if (validItems.length === 0) {
      toast.error('Bitte fügen Sie mindestens eine Position mit Beschreibung und Preis hinzu');
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch('/api/billing/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          due_date: dueDate,
          items: validItems,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        toast.success('Rechnung erfolgreich erstellt');
        setOpen(false);
        setMemberId('');
        setDueDate(addDays(new Date(), 14).toISOString().split('T')[0]);
        setNotes('');
        setItems([
          {
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxRate: 19,
            itemType: 'other',
          },
        ]);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(`Fehler: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      console.error('Failed to create invoice:', err);
      toast.error('Fehler bei der Rechnungserstellung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Rechnung erstellen
      </Button>
      <CenteredModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        className="max-w-4xl"
        ariaLabel="Neue Rechnung erstellen"
      >
        <div className="space-y-1 mb-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            Neue Rechnung erstellen
          </h2>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie eine neue Rechnung für ein Mitglied
          </p>
        </div>

        <div className="space-y-6 py-4">
          {/* Member Selection with Live Search */}
          <div>
            <Label htmlFor="member">Mitglied / Trainer</Label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="member"
                  placeholder="Name oder E-Mail suchen..."
                  className="pl-8"
                  value={
                    memberId ? (members.find((m) => m.id === memberId)?.name ?? '') : memberSearch
                  }
                  onChange={(e) => {
                    setMemberId('');
                    setMemberSearch(e.target.value);
                    setMemberSearchOpen(true);
                  }}
                  onFocus={() => setMemberSearchOpen(true)}
                  onBlur={handleSearchBlur}
                />
                {memberId && (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberId('');
                      setMemberSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                  >
                    ×
                  </button>
                )}
              </div>
              {memberSearchOpen && !memberId && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-md">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMemberId(m.id);
                          setMemberSearch('');
                          setMemberSearchOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>
                          {m.name} <span className="text-muted-foreground">({m.email})</span>
                        </span>
                        {m.role && (
                          <span
                            className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${
                              m.role === 'trainer'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-info-100 text-info-700'
                            }`}
                          >
                            {m.role === 'trainer' ? 'Trainer' : 'Mitglied'}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Keine Ergebnisse für „{memberSearch}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Positionen</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Position hinzufügen
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-12 gap-4">
                      {/* Description */}
                      <div className="col-span-12 md:col-span-4">
                        <Label htmlFor={`description-${index}`} className="text-sm">
                          Beschreibung
                        </Label>
                        <Input
                          id={`description-${index}`}
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="z.B. Mitgliedsbeitrag Mai 2026"
                        />
                      </div>

                      {/* Type */}
                      <div className="col-span-6 md:col-span-3">
                        <Label htmlFor={`type-${index}`} className="text-sm">
                          Typ
                        </Label>
                        <Select
                          value={item.itemType}
                          onValueChange={(value) =>
                            updateItem(index, 'itemType', value as InvoiceItem['itemType'])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="membership_fee">Mitgliedsbeitrag</SelectItem>
                            <SelectItem value="training_fee">Trainingsgebühr</SelectItem>
                            <SelectItem value="court_fee">Platzgebühr</SelectItem>
                            <SelectItem value="dunning_fee">Mahngebühr</SelectItem>
                            <SelectItem value="other">Sonstiges</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-3 md:col-span-2">
                        <Label htmlFor={`quantity-${index}`} className="text-sm">
                          Menge
                        </Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, 'quantity', parseInt(e.target.value) || 1)
                          }
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-3 md:col-span-2">
                        <Label htmlFor={`unitPrice-${index}`} className="text-sm">
                          Preis (€)
                        </Label>
                        <Input
                          id={`unitPrice-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      {/* Tax Rate */}
                      <div className="col-span-3 md:col-span-2">
                        <Label htmlFor={`taxRate-${index}`} className="text-sm">
                          MwSt (%)
                        </Label>
                        <Input
                          id={`taxRate-${index}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.taxRate}
                          onChange={(e) =>
                            updateItem(index, 'taxRate', parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="col-span-12 md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Hinweise zur Rechnung"
            />
          </div>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Zwischensumme:</span>
                  <span className="font-medium">{calculateSubtotal().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MwSt:</span>
                  <span className="font-medium">{calculateTax().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Gesamtbetrag:</span>
                  <span>{calculateTotal().toFixed(2)} €</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="outline" onClick={() => setOpen(false)} className="mt-2 sm:mt-0">
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Wird erstellt...' : 'Rechnung erstellen'}
          </Button>
        </div>
      </CenteredModal>
    </>
  );
}
