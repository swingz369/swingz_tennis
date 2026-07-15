'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { PageHeader } from '@/components/ui/page-header';

export default function NewTournamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    format: 'single_elimination',
    category: 'open',
    surface: '',
    max_participants: '16',
    registration_deadline: '',
    start_date: '',
    end_date: '',
    status: 'registration',
    prize_info: '',
    entry_fee: '0',
  });

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.start_date) {
      setError('Name und Startdatum sind erforderlich');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_participants: parseInt(form.max_participants) || 16,
          entry_fee: parseFloat(form.entry_fee) || 0,
          registration_deadline: form.registration_deadline || null,
          end_date: form.end_date || null,
          surface: form.surface || null,
          description: form.description || null,
          prize_info: form.prize_info || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Erstellen');
      router.push('/admin/tournaments');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="p-1 h-auto">
          <Link href="/admin/tournaments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title="Neues Turnier" description="Turnier anlegen" />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-0">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning-500" />
              Turnier-Details
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="z.B. Vereinsmeisterschaft 2026"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Beschreibung</Label>
              <Input
                id="description"
                placeholder="Kurze Beschreibung des Turniers"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Format</Label>
                <Select value={form.format} onValueChange={(v) => set('format', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_elimination">K.O.-System</SelectItem>
                    <SelectItem value="double_elimination">Doppel-K.O.</SelectItem>
                    <SelectItem value="round_robin">Jeder gegen jeden</SelectItem>
                    <SelectItem value="swiss">Schweizer System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Offen</SelectItem>
                    <SelectItem value="men">Herren</SelectItem>
                    <SelectItem value="women">Damen</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="junior">Junioren</SelectItem>
                    <SelectItem value="senior">Senioren</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="surface">Belag</Label>
                <Input
                  id="surface"
                  placeholder="z.B. Sand, Hartplatz"
                  value={form.surface}
                  onChange={(e) => set('surface', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_participants">Max. Teilnehmer</Label>
                <Input
                  id="max_participants"
                  type="number"
                  min="2"
                  max="256"
                  value={form.max_participants}
                  onChange={(e) => set('max_participants', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Startdatum *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => set('start_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">Enddatum</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => set('end_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="registration_deadline">Anmeldefrist</Label>
              <Input
                id="registration_deadline"
                type="date"
                value={form.registration_deadline}
                onChange={(e) => set('registration_deadline', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="entry_fee">Startgebühr (€)</Label>
                <Input
                  id="entry_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.entry_fee}
                  onChange={(e) => set('entry_fee', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="registration">Anmeldung offen</SelectItem>
                    <SelectItem value="active">Aktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prize_info">Preise / Auszeichnungen</Label>
              <Input
                id="prize_info"
                placeholder="z.B. Pokal und Urkunde für die Top 3"
                value={form.prize_info}
                onChange={(e) => set('prize_info', e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-error-500">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" asChild disabled={loading}>
                <Link href="/admin/tournaments">Abbrechen</Link>
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-brand-light hover:bg-brand-light/80 text-white"
                disabled={loading}
              >
                {loading ? 'Speichern…' : 'Turnier anlegen'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
