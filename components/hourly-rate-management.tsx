'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  Plus,
  Edit,
  XCircle,
  History,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface HourlyRateTier {
  id: string;
  name: string;
  description?: string;
  baseRate: number;
  trainingTypes: string[];
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainerHourlyRate {
  id: string;
  trainerId: string;
  trainerName: string;
  baseRate: number;
  overrideRate?: number;
  effectiveRate: number;
  validFrom: string;
  validUntil?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateHistoryEntry {
  id: string;
  trainerId: string;
  trainerName: string;
  oldRate: number;
  newRate: number;
  changedAt: string;
  changedBy: string;
  reason?: string;
}

export default function HourlyRateManagement() {
  const [rateTiers, setRateTiers] = useState<HourlyRateTier[]>([]);
  const [trainerRates, setTrainerRates] = useState<TrainerHourlyRate[]>([]);
  const [rateHistory, setRateHistory] = useState<RateHistoryEntry[]>([]);
  const [selectedTab, setSelectedTab] = useState<'tiers' | 'trainers' | 'history'>('tiers');
  const [editForm, setEditForm] = useState<Partial<HourlyRateTier | TrainerHourlyRate>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tiersRes, trainersRes, historyRes] = await Promise.all([
        fetch('/api/hourly-rates/tiers'),
        fetch('/api/hourly-rates/trainers'),
        fetch('/api/hourly-rates/history'),
      ]);

      if (tiersRes.ok) {
        const tiersData = await tiersRes.json();
        setRateTiers(tiersData.rateTiers || []);
      }

      if (trainersRes.ok) {
        const trainersData = await trainersRes.json();
        setTrainerRates(trainersData.trainerRates || []);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setRateHistory(historyData.history || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTier = async () => {
    try {
      const response = await fetch('/api/hourly-rates/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to create rate tier');
      }

      const data = await response.json();
      setRateTiers([...rateTiers, data.rateTier]);
      setEditForm({});
      toast.success('Stundensatz-Stufe erfolgreich erstellt');
    } catch (error) {
      toast.error('Fehler beim Erstellen der Stundensatz-Stufe');
      console.error('Create error:', error);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteTier = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDeleteTier = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    try {
      const response = await fetch(`/api/hourly-rates/tiers/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete rate tier');
      }

      setRateTiers(rateTiers.filter((t) => t.id !== id));
      toast.success('Stundensatz-Stufe erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen der Stundensatz-Stufe');
      console.error('Delete error:', error);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const getExperienceLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-blue-100 text-blue-700';
      case 'intermediate':
        return 'bg-green-100 text-green-700';
      case 'advanced':
        return 'bg-orange-100 text-orange-700';
      case 'professional':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getExperienceLevelLabel = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'Anfänger';
      case 'intermediate':
        return 'Fortgeschritten';
      case 'advanced':
        return 'Erfahren';
      case 'professional':
        return 'Professionell';
      default:
        return level;
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
          <h1 className="text-2xl font-bold text-brand-primary">Stundensatz verwalten</h1>
          <p className="text-gray-500">Verwaltung von Stundensätzen und Tarifstufen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList>
          <TabsTrigger value="tiers">
            <DollarSign className="h-4 w-4 mr-2" />
            Tarifstufen ({rateTiers.length})
          </TabsTrigger>
          <TabsTrigger value="trainers">
            <User className="h-4 w-4 mr-2" />
            Trainer-Stundensätze ({trainerRates.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Verlauf ({rateHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tiers" className="mt-6">
          <div className="space-y-4">
            {/* Create New Tier */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Neue Tarifstufe erstellen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={(editForm as Partial<HourlyRateTier>).name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="z.B. Anfänger-Training"
                    />
                  </div>
                  <div>
                    <Label>Basisrate (€)</Label>
                    <Input
                      type="number"
                      value={(editForm as Partial<HourlyRateTier>).baseRate || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, baseRate: parseFloat(e.target.value) })
                      }
                      placeholder="35"
                    />
                  </div>
                  <div>
                    <Label>Erfahrungslevel</Label>
                    <select
                      value={(editForm as Partial<HourlyRateTier>).experienceLevel || ''}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          experienceLevel: e.target.value as HourlyRateTier['experienceLevel'],
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    >
                      <option value="">Bitte auswählen...</option>
                      <option value="beginner">Anfänger</option>
                      <option value="intermediate">Fortgeschritten</option>
                      <option value="advanced">Erfahren</option>
                      <option value="professional">Professionell</option>
                    </select>
                  </div>
                  <div>
                    <Label>Beschreibung</Label>
                    <Input
                      value={(editForm as Partial<HourlyRateTier>).description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Beschreibung der Tarifstufe"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateTier} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Tarifstufe erstellen
                </Button>
              </CardContent>
            </Card>

            {/* Rate Tiers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rateTiers.map((tier) => (
                <Card key={tier.id} className={!tier.isActive ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{tier.name}</CardTitle>
                        {tier.description && (
                          <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                        )}
                      </div>
                      <Badge
                        variant={tier.isActive ? 'default' : 'outline'}
                        className={tier.isActive ? 'bg-green-100 text-green-700' : ''}
                      >
                        {tier.isActive ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Basisrate:</span>
                        <span className="text-2xl font-bold text-brand-primary">
                          €{tier.baseRate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getExperienceLevelColor(tier.experienceLevel)}>
                          {getExperienceLevelLabel(tier.experienceLevel)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tier.trainingTypes.map((type, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditForm(tier);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Bearbeiten
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTier(tier.id)}
                        >
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
        </TabsContent>

        <TabsContent value="trainers" className="mt-6">
          <div className="space-y-4">
            {/* Trainer Rates List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trainerRates.map((rate) => (
                <Card key={rate.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{rate.trainerName}</CardTitle>
                        <p className="text-sm text-gray-600 mt-1">ID: {rate.trainerId}</p>
                      </div>
                      <Badge variant="secondary">
                        <DollarSign className="h-3 w-3 mr-1" />€{rate.effectiveRate}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Basisrate:</span>
                        <span className="font-medium">€{rate.baseRate}</span>
                      </div>
                      {rate.overrideRate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Override:</span>
                          <span className="font-medium text-green-600">€{rate.overrideRate}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gültig ab:</span>
                        <span className="font-medium">
                          {format(parseISO(rate.validFrom), 'dd. MMM yyyy', { locale: de })}
                        </span>
                      </div>
                      {rate.validUntil && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Gültig bis:</span>
                          <span className="font-medium">
                            {format(parseISO(rate.validUntil), 'dd. MMM yyyy', { locale: de })}
                          </span>
                        </div>
                      )}
                      {rate.reason && (
                        <div className="pt-2 border-t">
                          <span className="text-gray-600">Grund:</span>
                          <p className="text-gray-700 mt-1">{rate.reason}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-3 border-t mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditForm(rate);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-3">
            {rateHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500">Kein Verlauf verfügbar</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              rateHistory.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="h-5 w-5 text-gray-400" />
                          <div>
                            <div className="font-semibold">{entry.trainerName}</div>
                            <div className="text-sm text-gray-600">ID: {entry.trainerId}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Von:</span>
                            <span className="font-medium text-red-600">€{entry.oldRate}</span>
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Auf:</span>
                            <span className="font-medium text-green-600">€{entry.newRate}</span>
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          </div>
                        </div>
                        {entry.reason && (
                          <div className="mt-2 text-sm text-gray-600">Grund: {entry.reason}</div>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                          Geändert am{' '}
                          {format(parseISO(entry.changedAt), 'dd. MMM yyyy HH:mm', { locale: de })}{' '}
                          von {entry.changedBy}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Stundensatz-Stufe löschen"
        description="Möchten Sie diese Stundensatz-Stufe wirklich löschen?"
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDeleteTier}
      />
    </div>
  );
}
