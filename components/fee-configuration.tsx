'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Plus, Edit, XCircle, Download, Repeat } from 'lucide-react';
import { toast } from 'sonner';

export interface FeeConfiguration {
  id: string;
  name: string;
  description?: string;
  type: 'membership' | 'training' | 'court' | 'other';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  conditions?: {
    minAge?: number;
    maxAge?: number;
    memberType?: string[];
    trainingGroup?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export default function FeeConfigurationManagement() {
  const [feeConfigurations, setFeeConfigurations] = useState<FeeConfiguration[]>([]);
  const [editForm, setEditForm] = useState<Partial<FeeConfiguration>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFeeConfigurations();
  }, []);

  const loadFeeConfigurations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/fee-configurations');
      if (!response.ok) {
        throw new Error('Failed to load fee configurations');
      }
      const data = await response.json();
      setFeeConfigurations(data.feeConfigurations || []);
    } catch (error) {
      console.error('Failed to load fee configurations:', error);
      toast.error('Fehler beim Laden der Gebührenkonfiguration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFee = async () => {
    try {
      const response = await fetch('/api/fee-configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create fee configuration');
      }

      const data = await response.json();
      setFeeConfigurations([...feeConfigurations, data.feeConfiguration]);
      setEditForm({});
      toast.success('Gebührenkonfiguration erfolgreich erstellt');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim Erstellen der Gebührenkonfiguration'
      );
      console.error('Create error:', error);
    }
  };

  const handleDeleteFee = async (id: string) => {
    if (!confirm('Möchten Sie diese Gebührenkonfiguration wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/fee-configurations/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete fee configuration');
      }

      setFeeConfigurations(feeConfigurations.filter((f) => f.id !== id));
      toast.success('Gebührenkonfiguration erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen der Gebührenkonfiguration');
      console.error('Delete error:', error);
    }
  };

  const getTypeColor = (type: FeeConfiguration['type']) => {
    switch (type) {
      case 'membership':
        return 'bg-blue-100 text-blue-700';
      case 'training':
        return 'bg-green-100 text-green-700';
      case 'court':
        return 'bg-purple-100 text-purple-700';
      case 'other':
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: FeeConfiguration['type']) => {
    switch (type) {
      case 'membership':
        return 'Mitgliedschaft';
      case 'training':
        return 'Training';
      case 'court':
        return 'Platz';
      case 'other':
        return 'Sonstiges';
    }
  };

  const getCycleLabel = (cycle: FeeConfiguration['billingCycle']) => {
    switch (cycle) {
      case 'monthly':
        return 'Monatlich';
      case 'quarterly':
        return 'Vierteljährlich';
      case 'yearly':
        return 'Jährlich';
      case 'one_time':
        return 'Einmalig';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Beitragskonfiguration</h1>
          <p className="text-gray-500">Verwaltung aller Gebühren und Beiträge</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Create New Fee */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Gebührenkonfiguration erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="z.B. Jahresmitgliedschaft"
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Input
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Beschreibung der Gebühr"
              />
            </div>
            <div>
              <Label>Typ</Label>
              <select
                value={editForm.type || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    type: e.target.value as 'membership' | 'training' | 'court' | 'other',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Bitte auswählen...</option>
                <option value="membership">Mitgliedschaft</option>
                <option value="training">Training</option>
                <option value="court">Platz</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>Betrag (€)</Label>
              <Input
                type="number"
                value={editForm.amount || ''}
                onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Währung</Label>
              <Input
                value={editForm.currency || 'EUR'}
                onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                placeholder="EUR"
              />
            </div>
            <div>
              <Label>Abrechnungszyklus</Label>
              <select
                value={editForm.billingCycle || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    billingCycle: e.target.value as 'monthly' | 'quarterly' | 'yearly' | 'one_time',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Bitte auswählen...</option>
                <option value="monthly">Monatlich</option>
                <option value="quarterly">Vierteljährlich</option>
                <option value="yearly">Jährlich</option>
                <option value="one_time">Einmalig</option>
              </select>
            </div>
            <div>
              <Label>Gültig ab</Label>
              <Input
                type="date"
                value={editForm.validFrom || ''}
                onChange={(e) => setEditForm({ ...editForm, validFrom: e.target.value })}
              />
            </div>
            <div>
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={editForm.validUntil || ''}
                onChange={(e) => setEditForm({ ...editForm, validUntil: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={handleCreateFee} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Gebührenkonfiguration erstellen
          </Button>
        </CardContent>
      </Card>

      {/* Fee Configurations List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Gebührenkonfigurationen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feeConfigurations.map((fee) => (
            <Card key={fee.id} className={!fee.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{fee.name}</CardTitle>
                    {fee.description && (
                      <p className="text-sm text-gray-600 mt-1">{fee.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Badge className={getTypeColor(fee.type)}>{getTypeLabel(fee.type)}</Badge>
                    {!fee.isActive && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-700">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Betrag:</span>
                    <span className="text-2xl font-bold text-brand-primary">
                      {fee.amount.toFixed(2)} {fee.currency}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{getCycleLabel(fee.billingCycle)}</span>
                  </div>

                  {fee.validFrom && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Gültig ab: {format(parseISO(fee.validFrom), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                  )}

                  {fee.validUntil && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>
                        Gültig bis:{' '}
                        {format(parseISO(fee.validUntil), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                  )}

                  {fee.conditions && (
                    <div className="pt-3 border-t">
                      <div className="text-sm font-medium mb-2">Bedingungen:</div>
                      <div className="space-y-1 text-sm text-gray-600">
                        {fee.conditions.minAge && (
                          <div>Mindestalter: {fee.conditions.minAge} Jahre</div>
                        )}
                        {fee.conditions.maxAge && (
                          <div>Höchstalter: {fee.conditions.maxAge} Jahre</div>
                        )}
                        {fee.conditions.memberType && (
                          <div>Mitgliedstyp: {fee.conditions.memberType.join(', ')}</div>
                        )}
                        {fee.conditions.trainingGroup && (
                          <div>Trainingsgruppen: {fee.conditions.trainingGroup.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditForm(fee);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteFee(fee.id)}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
