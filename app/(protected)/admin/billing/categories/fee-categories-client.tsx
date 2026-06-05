'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';

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
  const [form, setForm] = useState({
    name: '',
    type: 'training',
    amount: 0,
  });

  const handleCreate = async () => {
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
        // Map the FeeConfiguration entity to the local FeeConfig shape
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
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Fee config creation failed:', err);
      }
    } catch (e) {
      console.error('Fee config creation error:', e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Preiskategorien</h1>
        <Button onClick={() => setCreating(true)}>Neue Kategorie</Button>
      </div>

      {creating && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Name (z.B. Erwachsene)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="membership">Mitgliedschaft</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Preis (€)"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
            />
            <div className="flex gap-2">
              <Button onClick={handleCreate}>Speichern</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>
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
                <div key={cat.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {cat.type === 'training' ? 'Training' : 'Mitgliedschaft'} ·{' '}
                      {cat.amount.toFixed(2)} €
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {cat.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
