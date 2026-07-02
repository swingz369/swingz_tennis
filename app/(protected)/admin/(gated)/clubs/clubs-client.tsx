'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { apiFetch } from '@/lib/api-fetch';
import { buildPageUrl } from '@/lib/pagination';
import type { PaginationMeta } from '@/lib/pagination';
import { Building2, Users, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

export interface ClubItem {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  maxMembers: number;
}

interface ClubsClientProps {
  initialClubs: ClubItem[];
  pagination: PaginationMeta;
  searchParams: Record<string, string | string[] | undefined>;
}

export function ClubsClient({ initialClubs, pagination, searchParams }: ClubsClientProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', maxMembers: 500 });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClub),
      });
      if (res.ok) {
        setShowDialog(false);
        setNewClub({ name: '', maxMembers: 500 });
        router.refresh();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || `Fehler ${res.status}: ${res.statusText}`);
      }
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="Vereine verwalten"
        description={`${pagination.totalCount} ${pagination.totalCount === 1 ? 'Verein' : 'Vereine'} registriert`}
        breadcrumbs={[{ label: 'Vereine' }]}
        actions={[{ label: 'Neuer Verein', icon: Plus, onClick: () => setShowDialog(true) }]}
        className="mb-6"
      />

      {showDialog && (
        <Card className="mb-6 border-brand-light/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Neuen Verein anlegen</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowDialog(false);
                setError(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClub} className="space-y-4">
              {error && (
                <div className="p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newClub.name}
                  onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
                  placeholder="z.B. TC Blau-Weiß Musterstadt"
                  required
                />
              </div>
              <div>
                <Label htmlFor="maxMembers">Max. Mitglieder</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  value={newClub.maxMembers}
                  onChange={(e) =>
                    setNewClub({
                      ...newClub,
                      maxMembers: parseInt(e.target.value) || 100,
                    })
                  }
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Wird erstellt…' : 'Erstellen'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setError(null);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {initialClubs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">Keine Vereine gefunden.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Erstellen Sie einen neuen Verein, um zu beginnen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialClubs.map((club) => (
            <Card key={club.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{club.name}</CardTitle>
                  <Badge variant={club.status === 'active' ? 'default' : 'secondary'}>
                    {club.status === 'active' ? 'Aktiv' : club.status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {club.memberCount} / {club.maxMembers} Mitglieder
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-brand-primary rounded-full h-2 transition-all"
                    style={{
                      width: `${Math.min(100, (club.memberCount / club.maxMembers) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {Math.round((club.memberCount / club.maxMembers) * 100)}% Auslastung
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="mt-6">
          <PaginationNav meta={pagination} buildUrl={(p) => `?${buildPageUrl(searchParams, p)}`} />
        </div>
      )}
    </div>
  );
}
