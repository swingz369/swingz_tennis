'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, Tag } from 'lucide-react';

interface FeeConfig {
  id: string;
  name: string;
  type: string;
  amount: number;
  billing_cycle: string;
  is_active: boolean;
}

export function BillingCategoriesTabs({
  children,
  initialCategories,
}: {
  children: React.ReactNode;
  initialCategories: FeeConfig[];
}) {
  const [categories, setCategories] = useState<FeeConfig[]>(initialCategories);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'training', amount: 0 });

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/fee-configurations', {
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
      }
    } catch (e) {
      console.error('Fee config creation error:', e);
    }
  };

  return (
    <Tabs defaultValue="invoices" className="space-y-6">
      <TabsList className="w-full max-w-md grid grid-cols-2 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
        <TabsTrigger
          value="invoices"
          className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Rechnungen
        </TabsTrigger>
        <TabsTrigger
          value="categories"
          className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <Tag className="h-4 w-4 mr-2" />
          Kategorien
        </TabsTrigger>
      </TabsList>

      {/* Rechnungen Tab — renders the existing BillingClient */}
      <TabsContent value="invoices">{children}</TabsContent>

      {/* Kategorien Tab — inline FeeCategories */}
      <TabsContent value="categories">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-brand-primary">Preiskategorien</h2>
              <p className="text-sm text-gray-500">
                {categories.length} {categories.length === 1 ? 'Kategorie' : 'Kategorien'}
              </p>
            </div>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-light text-white rounded-lg hover:bg-brand-light/80 transition-colors"
              >
                Neue Kategorie
              </button>
            )}
          </div>

          {creating && (
            <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 space-y-3">
              <input
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                placeholder="Name (z.B. Erwachsene)"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <div className="flex gap-3">
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                >
                  <option value="training">Training</option>
                  <option value="membership">Mitgliedschaft</option>
                </select>
                <input
                  type="number"
                  placeholder="Preis (€)"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))
                  }
                  className="w-32 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 text-sm font-medium bg-brand-light text-white rounded-lg hover:bg-brand-light/80 transition-colors"
                >
                  Speichern
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 divide-y divide-gray-100 dark:divide-white/5">
            {categories.length === 0 ? (
              <div className="py-12 text-center">
                <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Noch keine Kategorien angelegt.</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{cat.name}</p>
                    <p className="text-xs text-gray-500">
                      {cat.type === 'training' ? 'Training' : 'Mitgliedschaft'} ·{' '}
                      {cat.amount.toFixed(2)} €
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      cat.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {cat.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
