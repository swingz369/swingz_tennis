'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { PaginationNav } from '@/components/ui/pagination-nav';
import type { PaginationMeta } from '@/lib/pagination';
import type { Club, ClubsResponse } from '@/lib/clubs';
import { apiFetch } from '@/lib/api-fetch';

const CLUBS_PER_PAGE = 20;

export default function ClubsAdminPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', maxMembers: 500 });
  const [error, setError] = useState<string | null>(null);

  const fetchClubs = useCallback(async (p: number = 1) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clubs?page=${p}&limit=${CLUBS_PER_PAGE}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch clubs: ${res.status}`);
      }
      const data: ClubsResponse = await res.json();
      setClubs(data.clubs ?? []);
      setPagination(data.pagination ?? null);
    } catch (err) {
      console.error('Failed to fetch clubs:', err);
      setClubs([]);
      setError('Fehler beim Laden der Vereine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClubs(page);
  }, [fetchClubs, page]);

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClub),
      });
      if (res.ok) {
        setShowDialog(false);
        setNewClub({ name: '', maxMembers: 500 });
        fetchClubs(page);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || `Fehler ${res.status}: ${res.statusText}`;
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Failed to create club:', err);
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Vereine verwalten</h1>
        <Button onClick={() => setShowDialog(true)}>Neuer Verein</Button>
      </div>

      {showDialog && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Neuen Verein anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClub} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newClub.name}
                  onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="maxMembers">Max. Mitglieder</Label>
                <Input
                  id="maxMembers"
                  type="number"
                  value={newClub.maxMembers}
                  onChange={(e) => setNewClub({ ...newClub, maxMembers: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Erstellen</Button>
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Keine Vereine gefunden.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <Card key={club.id}>
              <CardHeader>
                <CardTitle>{club.name}</CardTitle>
                <CardDescription>Status: {club.status}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Mitglieder: {club.memberCount} / {club.maxMembers}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && <PaginationNav meta={pagination} compact onPageChange={setPage} />}
    </div>
  );
}
