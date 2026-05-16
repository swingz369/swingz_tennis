'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  GraduationCap,
  ChevronRight,
  Search,
  Trophy,
  LogOut,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconBox } from '@/components/ui/icon-box';
import { cn } from '@/lib/utils';

interface Club {
  id: string;
  name: string;
  status?: string;
  memberCount: number;
  trainerCount: number;
}

interface SelectAdminClubClientProps {
  clubs: Club[];
  userName: string;
}

export function SelectAdminClubClient({ clubs, userName }: SelectAdminClubClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);

  const filtered = clubs.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = async (clubId: string) => {
    setSelecting(clubId);
    try {
      const res = await fetch('/api/admin/switch-club', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId }),
      });
      if (res.ok) {
        router.push('/admin');
      } else {
        console.error('Failed to switch club');
        setSelecting(null);
      }
    } catch (err) {
      console.error(err);
      setSelecting(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-surface-dark to-brand-secondary/40 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <IconBox icon={Trophy} size="md" variant="gradient-primary" className="h-9 w-9" />
          <div>
            <span className="text-white font-bold text-lg">SWINGZ</span>
            <span className="ml-2 text-xs text-white/40 font-medium">Superadmin</span>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </form>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">Verein auswählen</h1>
            <p className="text-white/50 mt-1 text-sm">
              Hallo, <span className="text-white/80">{userName.split(' ')[0]}</span> — welchen
              Verein möchtest du verwalten?
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Verein suchen…"
              className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-light focus:ring-brand-light"
            />
          </div>

          {/* Club list */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <p className="text-center text-white/40 py-8 text-sm">Keine Vereine gefunden.</p>
            )}
            {filtered.map((club) => (
              <button
                key={club.id}
                onClick={() => handleSelect(club.id)}
                disabled={selecting !== null}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-brand-light/50 transition-all text-left group',
                  selecting === club.id && 'opacity-60 cursor-wait',
                  selecting !== null && selecting !== club.id && 'opacity-40'
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary/60 to-brand-light/40 shrink-0">
                  <Building2 className="h-6 w-6 text-brand-light dark:text-brand-light" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold truncate">{club.name}</span>
                    {club.status === 'inactive' && (
                      <Badge variant="secondary" className="text-xs bg-white/10 text-white/50">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-white/40">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {club.memberCount} Mitglieder
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {club.trainerCount} Trainer
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-brand-light dark:text-brand-light transition-colors shrink-0" />
              </button>
            ))}
          </div>

          {/* Back to superadmin dashboard */}
          <div className="mt-8 text-center">
            <a
              href="/superadmin"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← Zurück zur Plattform-Übersicht
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
