'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Club {
  id: string;
  name: string;
  maxMembers: number;
  status: string;
  memberCount: number;
}

export default function ClubsAdminPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newClub, setNewClub] = useState({ name: '', maxMembers: 500, openingHours: {} });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      const res = await fetch('/api/clubs');
      if (!res.ok) {
        throw new Error(`Failed to fetch clubs: ${res.status}`);
      }
      const data = await res.json();
      setClubs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch clubs:', err);
      setClubs([]);
      setError('Fehler beim Laden der Vereine');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClub,
          openingHours: {
            monday: { open: '09:00', close: '22:00' },
            tuesday: { open: '09:00', close: '22:00' },
            wednesday: { open: '09:00', close: '22:00' },
            thursday: { open: '09:00', close: '22:00' },
            friday: { open: '09:00', close: '22:00' },
            saturday: { open: '09:00', close: '22:00' },
            sunday: { open: '09:00', close: '22:00' },
          },
        }),
      });
      if (res.ok) {
        setShowDialog(false);
        setNewClub({ name: '', maxMembers: 500, openingHours: {} });
        fetchClubs();
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

  if (loading) return <div>Loading...</div>;

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
    </div>
  );
}
