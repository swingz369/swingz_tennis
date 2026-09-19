'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { extractErrorMessage } from '@/lib/typed-helpers';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import type { LeaguePlayer, Member } from './types';

export function RosterTab({
  leagueId,
  players,
  members,
  onChanged,
}: {
  leagueId: string;
  players: LeaguePlayer[];
  members: Member[];
  onChanged: () => void;
}) {
  const suggestedName = (p: LeaguePlayer) =>
    p.suggested_member_id ? members.find((m) => m.id === p.suggested_member_id)?.name : undefined;

  const handleAssignPlayer = async (playerId: string, memberId: string | null) => {
    try {
      const res = await apiFetch(`/api/leagues/${leagueId}/roster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, member_id: memberId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) || 'Zuordnung fehlgeschlagen');
      toast.success(memberId ? 'Mitglied zugeordnet' : 'Zuordnung entfernt');
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen');
    }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Kader (Meldeliste)</h2>
        {players?.[0]?.synced_at && (
          <span className="text-xs text-muted-foreground">
            Stand: {new Date(players[0].synced_at).toLocaleDateString('de-DE')}
          </span>
        )}
      </div>

      {(players?.length ?? 0) === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
          Noch kein Kader hinterlegt.
        </div>
      ) : (
        <div className="space-y-1.5">
          {players.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums text-muted-foreground w-6">
                    {p.position_number ?? '–'}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.lk && (
                    <Badge variant="outline" className="text-xs">
                      {p.lk}
                    </Badge>
                  )}
                </div>
                {/* Verknüpfte Zeilen zeigen nur ein Abzeichen. Das Auswahlfeld
                    steht nur dort, wo wirklich etwas zuzuordnen ist — sonst
                    rendert ein 300er-Verein pro Kaderzeile 300 Optionen. */}
                {p.member_id ? (
                  <button
                    type="button"
                    aria-label={`Zuordnung von ${p.name} lösen`}
                    onClick={() => handleAssignPlayer(p.id, null)}
                    className="text-2xs"
                  >
                    <Badge variant="secondary" className="text-2xs cursor-pointer">
                      Mitglied verknüpft ✕
                    </Badge>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {suggestedName(p) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleAssignPlayer(p.id, p.suggested_member_id ?? null)}
                      >
                        Ist {suggestedName(p)}?
                      </Button>
                    )}
                    <select
                      aria-label={`Mitglied für ${p.name} zuordnen`}
                      value=""
                      onChange={(e) => handleAssignPlayer(p.id, e.target.value || null)}
                      className="text-xs p-1.5 rounded border bg-background max-w-[14rem]"
                    >
                      <option value="">— Mitglied zuordnen —</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
