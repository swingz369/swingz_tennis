'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub } from '@/hooks/use-user-data';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';
import { Breadcrumb } from '@/components/ui/breadcrumb';

export function NewSeasonForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { data: clubData, refetch: refetchClub } = useUserClub();
  const clubId = clubData?.clubId ?? null;
  const [formData, setFormData] = useState({
    name: '',
    season_type: 'summer' as 'summer' | 'winter',
    year: new Date().getFullYear(),
    start_date: '',
    end_date: '',
    preferences_deadline: '',
    description: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (!formData.name || !formData.start_date || !formData.end_date) {
        toast.error('Bitte fülle alle Pflichtfelder aus');
        return;
      }

      // Fehlt der Verein, sind die Vereinsdaten meist nur noch nicht geladen (die
      // Query kann beim Seitenaufruf abgebrochen sein) — dann hilft ein zweiter
      // Versuch, keine Aufforderung zum Neu-Anmelden.
      const effectiveClubId = clubId ?? (await refetchClub()).data?.clubId ?? null;
      if (!effectiveClubId) {
        toast.error('Vereinsdaten konnten nicht geladen werden. Bitte Seite neu laden.');
        return;
      }

      const response = await apiFetch('/api/seasons', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          club_id: effectiveClubId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Erstellen der Saison');
      }

      const data = await response.json();
      toast.success('Saison erstellt — Planung startet jetzt');
      // Auto-redirect to planning wizard (preferences are auto-opened by the API)
      router.push(`/admin/seasons/${data.season.id}/planning`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate season name based on type and year
  const generateSeasonName = () => {
    const type = formData.season_type === 'summer' ? 'Sommer' : 'Winter';
    const yearStr =
      formData.season_type === 'winter'
        ? `${formData.year}/${formData.year + 1}`
        : `${formData.year}`;
    return `${type} ${yearStr}`;
  };

  const handleAutoFillDates = () => {
    if (formData.season_type === 'summer') {
      handleInputChange('start_date', `${formData.year}-04-01`);
      handleInputChange('end_date', `${formData.year}-09-30`);
      handleInputChange('preferences_deadline', `${formData.year}-03-15`);
    } else {
      handleInputChange('start_date', `${formData.year}-10-01`);
      handleInputChange('end_date', `${formData.year + 1}-03-31`);
      handleInputChange('preferences_deadline', `${formData.year}-09-15`);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'Saisonplanung', href: '/admin/seasons' }, { label: 'Neue Saison' }]}
      />
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/seasons')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Neue Saison erstellen" description="Lege eine neue Trainingssaison an" />
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Saison-Details</CardTitle>
            <CardDescription>Grundlegende Informationen zur Saison</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Season Type & Year */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="season_type">
                  Saison-Typ <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.season_type}
                  onValueChange={(value: 'summer' | 'winter') => {
                    handleInputChange('season_type', value);
                    // Auto-update name
                    setTimeout(() => {
                      if (!formData.name || formData.name === generateSeasonName()) {
                        handleInputChange('name', generateSeasonName());
                      }
                    }, 0);
                  }}
                >
                  <SelectTrigger id="season_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summer">☀️ Sommer (April - September)</SelectItem>
                    <SelectItem value="winter">❄️ Winter (Oktober - März)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year">
                  Jahr <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="year"
                  type="number"
                  min="2024"
                  max="2030"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">
                  Saison-Name <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInputChange('name', generateSeasonName())}
                >
                  Name generieren
                </Button>
              </div>
              <Input
                id="name"
                placeholder="z.B. Sommer 2026"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            {/* Dates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Zeitraum</Label>
                <Button type="button" variant="ghost" size="sm" onClick={handleAutoFillDates}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Standard-Zeitraum einfügen
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    Startdatum <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">
                    Enddatum <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Preferences Deadline */}
            <div className="space-y-2">
              <Label htmlFor="preferences_deadline">Präferenz-Deadline (optional)</Label>
              <Input
                id="preferences_deadline"
                type="date"
                value={formData.preferences_deadline}
                onChange={(e) => handleInputChange('preferences_deadline', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Bis wann können User ihre Verfügbarkeit angeben
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Textarea
                id="description"
                placeholder="Beschreibe diese Saison…"
                rows={3}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Interne Notizen (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Interne Notizen für Admins..."
                rows={3}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/seasons')}
                disabled={loading}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Wird erstellt...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Saison erstellen
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
