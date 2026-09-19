import { ListState } from '@/components/ui/list-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Team } from './types';

export function StandingsTab({ teams }: { teams: Team[] }) {
  return (
    <>
      <h2 className="text-lg font-semibold">Tabelle</h2>
      {teams.length === 0 ? (
        <ListState empty emptyTitle="Keine Teams vorhanden" />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">Sp</TableHead>
                <TableHead className="text-center">S</TableHead>
                <TableHead className="text-center">U</TableHead>
                <TableHead className="text-center">N</TableHead>
                <TableHead className="text-right">Punkte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...teams]
                .sort((a, b) => (a.position ?? 999) - (b.position ?? 999))
                .map((team, idx) => (
                  <TableRow key={team.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {team.position ?? idx + 1}
                    </TableCell>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {team.matches_played}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-success-600 dark:text-success-400">
                      {team.matches_won}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-warning-600 dark:text-warning-400">
                      {team.matches_drawn}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-error-600 dark:text-error-400">
                      {team.matches_lost}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {team.points}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
