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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { addDays } from 'date-fns';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  itemType: 'membership_fee' | 'training_fee' | 'court_fee' | 'dunning_fee' | 'other';
}

interface CreateInvoiceDialogProps {
  onSuccess?: () => void;
  members: { id: string; name: string; email: string }[];
}

export default function CreateInvoiceDialog({ onSuccess, members }: CreateInvoiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberId, setMemberId] = useState('');
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

  const hasMembers = members.length > 0;

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
      const response = await fetch('/api/billing/invoices/create', {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Rechnung erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Rechnung erstellen</DialogTitle>
          <DialogDescription>Erstellen Sie eine neue Rechnung für ein Mitglied</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Member Selection */}
          <div>
            <Label htmlFor="member">Mitglied</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Mitglied wählen" />
              </SelectTrigger>
              <SelectContent>
                {hasMembers ? (
                  members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-sm text-gray-500">
                    Keine Mitglieder gefunden
                  </div>
                )}
              </SelectContent>
            </Select>
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
                  <span className="text-gray-600">Zwischensumme:</span>
                  <span className="font-medium">{calculateSubtotal().toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MwSt:</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Wird erstellt...' : 'Rechnung erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
