import { requireAuth } from '@/lib/auth';
import { MyLeaguesClient } from './my-leagues-client';

export const dynamic = 'force-dynamic';

/**
 * /member/leagues — "Meine Mannschaften" aus Sicht des Spielers.
 *
 * Gegenstück zur Admin-Sicht `/admin/leagues`: dort verwaltet der Sportwart,
 * hier sieht der Gemeldete seine eigenen Spieltage, seine LK und seine
 * Meldeposition. Erreichbar über die Sidebar („Spielen → Meine Mannschaften",
 * gated über `league_lineup`) und zusätzlich über die Dashboard-Kachel, sobald
 * das Mitglied in einer Meldeliste steht.
 */
export default async function MemberLeaguesPage() {
  await requireAuth();
  return <MyLeaguesClient />;
}
