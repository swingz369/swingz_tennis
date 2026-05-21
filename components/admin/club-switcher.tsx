/**
 * Club Switcher Component for Superadmin
 * Based on TSOWAPP implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Club {
  id: string;
  name: string;
}

interface ClubSwitcherProps {
  currentClubId: string | null;
  userRole: string;
}

/**
 * Club Switcher for Superadmin users
 * Allows switching between clubs without re-login
 */
export function ClubSwitcher({ currentClubId, userRole }: ClubSwitcherProps) {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(currentClubId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole === 'superadmin') {
      loadClubs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only show for superadmin
  if (userRole !== 'superadmin') {
    return null;
  }

  async function loadClubs() {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading clubs:', error);
        toast.error('Fehler beim Laden der Clubs');
        return;
      }

      setClubs(data || []);
    } catch (error) {
      console.error('Exception loading clubs:', error);
      toast.error('Fehler beim Laden der Clubs');
    } finally {
      setLoading(false);
    }
  }

  async function handleClubChange(clubId: string) {
    setSelectedClubId(clubId);

    try {
      // Set cookie via API route
      const response = await fetch('/api/admin/switch-club', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clubId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set club');
      }

      toast.success('Club gewechselt');

      // Refresh the page to reload data for new club
      router.refresh();
    } catch (error) {
      console.error('Error switching club:', error);
      toast.error('Fehler beim Club-Wechsel');
      setSelectedClubId(currentClubId); // Revert
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Lädt...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={selectedClubId || ''} onValueChange={handleClubChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Club auswählen" />
        </SelectTrigger>
        <SelectContent>
          {clubs.map((club) => (
            <SelectItem key={club.id} value={club.id}>
              <div className="flex items-center gap-2">
                {club.id === selectedClubId && <Check className="h-4 w-4" />}
                <span>{club.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Compact Club Switcher for Header
 */
export function ClubSwitcherCompact({ currentClubId, userRole }: ClubSwitcherProps) {
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(currentClubId);

  useEffect(() => {
    if (userRole === 'superadmin') {
      loadClubs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (userRole !== 'superadmin') {
    return null;
  }

  async function loadClubs() {
    const supabase = createClient();
    const { data } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    setClubs(data || []);
  }

  async function handleClubChange(clubId: string) {
    setSelectedClubId(clubId);

    try {
      await fetch('/api/admin/switch-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });

      router.refresh();
    } catch (error) {
      console.error('Error switching club:', error);
      setSelectedClubId(currentClubId);
    }
  }

  const currentClub = clubs.find((c) => c.id === selectedClubId);

  return (
    <Select value={selectedClubId || ''} onValueChange={handleClubChange}>
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <SelectValue>{currentClub?.name || 'Club wählen'}</SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {clubs.map((club) => (
          <SelectItem key={club.id} value={club.id}>
            {club.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
