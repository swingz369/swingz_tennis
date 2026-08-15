'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { ArrowLeft, Clock, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

interface PreferenceRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: 'member' | 'trainer';
  preferred_level: string | null;
  is_submitted: boolean;
  submitted_at: string | null;
  weekly_availability: Record<string, Array<{ start: string; end: string }>> | null;
  wish_partner_ids?: string[] | null;
  special_requests: string | null;
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
  professional: 'Profi',
};

function availabilitySlotCount(availability: PreferenceRow['weekly_availability']): number {
  if (!availability) return 0;
  return Object.values(availability).reduce((sum, slots) => sum + (slots?.length ?? 0), 0);
}

interface PreferencesPageProps {
  params: Promise<{ id: string }>;
}

export default function SeasonPreferencesPage({ params }: PreferencesPageProps) {
  const { id: seasonId } = use(params);
  const router = useRouter();
  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/seasons/${seasonId}/preferences`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(extractErrorMessage(data) ?? 'Fehler beim Laden der Präferenzen');
        if (!cancelled) setPreferences(data.preferences ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  const submittedCount = preferences.filter((p) => p.is_submitted).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eingereichte Präferenzen"
        description={`${submittedCount} von ${preferences.length} eingereicht`}
        actions={[
          {
            label: 'Zurück zur Saison',
            icon: ArrowLeft,
            onClick: () => router.push(`/admin/seasons/${seasonId}`),
            variant: 'outline',
          },
        ]}
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : preferences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Noch keine Präferenzen eingereicht</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Rolle
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Level
                    </th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                      Zeitfenster
                    </th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                      Wunschpartner
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Sonderwünsche
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preferences.map((p, idx) => (
                    <tr
                      key={p.id}
                      className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{p.user_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{p.user_email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.user_role === 'trainer' ? 'Trainer' : 'Mitglied'}
                      </td>
                      <td className="px-4 py-2.5">
                        {p.is_submitted ? (
                          <Badge variant="default" className="text-xs">
                            Eingereicht
                            {p.submitted_at
                              ? ` · ${new Date(p.submitted_at).toLocaleDateString('de-DE')}`
                              : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Offen
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {p.preferred_level
                          ? (LEVEL_LABELS[p.preferred_level] ?? p.preferred_level)
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        {availabilitySlotCount(p.weekly_availability)}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums">
                        {p.wish_partner_ids?.length ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">
                        {p.special_requests || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/seasons/${seasonId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Saison
      </Button>
    </div>
  );
}
