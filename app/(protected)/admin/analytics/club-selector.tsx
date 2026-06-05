'use client';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Club {
  id: string;
  name: string;
}

interface ClubSelectorProps {
  clubs: Club[];
  selectedClubId: string;
}

export function ClubSelector({ clubs, selectedClubId }: ClubSelectorProps) {
  const handleChange = (newClubId: string) => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('clubId', newClubId);
    window.location.href = url.pathname + url.search;
  };

  if (clubs.length <= 1) return null;

  return (
    <div className="mb-4">
      <label htmlFor="club-selector" className="block text-sm font-medium text-foreground mb-1">
        Verein auswählen
      </label>
      <Select value={selectedClubId} onValueChange={handleChange}>
        <SelectTrigger id="club-selector" className="w-64">
          <SelectValue placeholder="Verein auswählen" />
        </SelectTrigger>
        <SelectContent>
          {clubs.map((club) => (
            <SelectItem key={club.id} value={club.id}>
              {club.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
