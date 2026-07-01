'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trophy, Calendar, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconBox } from '@/components/ui/icon-box';
import { NoTournamentsBrandedEmptyState } from '@/components/ui/empty-state';
import {
  STATUS_LABELS,
  STATUS_VARIANTS,
  FORMAT_LABELS_SHORT as FORMAT_LABELS,
} from '@/src/constants/tournaments';
import { PaginationNav } from '@/components/ui/pagination-nav';
import type { PaginationMeta } from '@/lib/pagination';

interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: string;
  category: string;
  start_date: string;
  end_date?: string;
  status: string;
  max_participants?: number;
  registration_deadline?: string;
  entry_fee?: number;
}

interface TournamentsClientProps {
  initialTournaments: Tournament[];
  pagination?: PaginationMeta;
}

export function TournamentsClient({ initialTournaments, pagination }: TournamentsClientProps) {
  const router = useRouter();
  const tournaments = initialTournaments;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Turniere</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Turnierverwaltung des Vereins</p>
        </div>
        <Button asChild size="sm" variant="primary" className="gap-1.5">
          <Link href="/admin/tournaments/new">
            <Plus className="h-4 w-4" />
            Neues Turnier
          </Link>
        </Button>
      </div>

      {tournaments.length === 0 ? (
        <NoTournamentsBrandedEmptyState onCreate={() => router.push('/admin/tournaments/new')} />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <IconBox icon={Trophy} size="md" variant="amber" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{t.name}</p>
                    <Badge variant={STATUS_VARIANTS[t.status] ?? 'secondary'} className="text-xs">
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.start_date).toLocaleDateString('de-DE')}
                      {t.end_date && ` – ${new Date(t.end_date).toLocaleDateString('de-DE')}`}
                    </span>
                    <span>{FORMAT_LABELS[t.format] ?? t.format}</span>
                    {t.max_participants && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        max. {t.max_participants}
                      </span>
                    )}
                    {t.entry_fee && t.entry_fee > 0 && <span>€{t.entry_fee}</span>}
                  </div>
                </div>
                <Link
                  href={`/admin/tournaments/${t.id}`}
                  className="text-xs text-brand-light hover:underline shrink-0"
                >
                  Details →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && (
        <PaginationNav
          meta={pagination}
          compact
          onPageChange={(p) => router.push(`/admin/tournaments?page=${p}`)}
        />
      )}
    </div>
  );
}
