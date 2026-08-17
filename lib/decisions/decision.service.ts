import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';
import type { Json } from '@/types/supabase';
import type {
  BoardDecision,
  CreateDecisionInput,
  UpdateDecisionInput,
  CastVoteInput,
  InvitationResponseInput,
  MeetingInvitation,
  DecisionType,
  DecisionChangeAction,
} from '@/lib/types/decisions';

const supabase = createServiceClient();
const log = createLogger('decisions:service');

// In-Memory LRU-Cache für User-Anzeigenamen (verhindert N+1 Lookups pro Audit-Eintrag).
// Bei DSGVO-Löschung eines Users schlägt der Lookup fehl → wir fallen auf 'gel\u00f6scht' zur\u00fcck.
// Maximale Cache-Gr\u00f6\u00d8e: 500 Eintr\u00e4ge (modul-lokal, kein Redis-Overhead).
const ACTOR_LABEL_CACHE_MAX = 500;
const actorLabelCache = new Map<string, string | null>();

async function lookupActorLabel(actorId: string | null): Promise<string | null> {
  if (actorId === null) return null; // System-/Cron-Aktion
  const cached = actorLabelCache.get(actorId);
  if (cached !== undefined) return cached;
  const { data } = await supabase.from('users').select('full_name').eq('id', actorId).maybeSingle();
  const label = data?.full_name ?? 'gelöscht';
  // LRU-ähnliches Evict wenn Cache zu groß
  if (actorLabelCache.size >= ACTOR_LABEL_CACHE_MAX) {
    const firstKey = actorLabelCache.keys().next().value;
    if (firstKey) actorLabelCache.delete(firstKey);
  }
  actorLabelCache.set(actorId, label);
  return label;
}

interface ChangeRecord {
  decisionId: string;
  action: DecisionChangeAction;
  actorId: string | null;
  actorLabel?: string | null;
  oldValues?: Partial<BoardDecision> | null;
  newValues?: Partial<BoardDecision> | null;
  details?: Record<string, unknown>;
}

export class DecisionService {
  private static instance: DecisionService;
  private constructor() {}
  public static getInstance(): DecisionService {
    if (!DecisionService.instance) DecisionService.instance = new DecisionService();
    return DecisionService.instance;
  }

  /**
   * Listet Beschlüsse eines Vereins (RLS-filtered durch service-role).
   */
  async listDecisions(
    clubId: string,
    options: {
      status?: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      limit?: number;
    } = {}
  ): Promise<BoardDecision[]> {
    let query = supabase
      .from('board_decisions')
      .select('*')
      .eq('club_id', clubId)
      .order('meeting_date', { ascending: false, nullsFirst: false });

    if (options.status) query = query.eq('status', options.status);
    query = query.limit(options.limit ?? 50);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to list decisions: ${error.message}`);
    return (data ?? []) as BoardDecision[];
  }

  /**
   * Erstellt einen Beschluss + optional Einladungen an Mitglieder.
   */
  async createDecision(
    clubId: string,
    createdByUserId: string,
    input: CreateDecisionInput
  ): Promise<BoardDecision> {
    const { data, error } = await supabase
      .from('board_decisions')
      .insert({
        club_id: clubId,
        title: input.title,
        description: input.description ?? null,
        decision_type: input.decision_type,
        meeting_date: input.meeting_date ?? null,
        status: input.meeting_date ? 'scheduled' : 'draft',
        created_by: createdByUserId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create decision: ${error.message}`);
    const decision = data as BoardDecision;

    // Sofort-Einladungen + Audit
    if (input.invited_member_ids && input.invited_member_ids.length > 0) {
      const invites = input.invited_member_ids.map((memberId) => ({
        decision_id: decision.id,
        member_id: memberId,
        status: 'pending' as const,
      }));
      const { error: inviteErr } = await supabase.from('meeting_invitations').insert(invites);
      if (!inviteErr) {
        await this.recordChange({
          decisionId: decision.id,
          action: 'invitation_sent',
          actorId: createdByUserId,
          details: { invited_count: invites.length, member_ids: input.invited_member_ids },
        });
      } else {
        log.warn('Einladungen konnten nicht eingefügt werden', {
          decisionId: decision.id,
          error: inviteErr.message,
        });
      }
    }

    await this.recordChange({
      decisionId: decision.id,
      action: 'created',
      actorId: createdByUserId,
      newValues: decision,
      details: { decision_type: decision.decision_type },
    });

    return decision;
  }

  /**
   * Aktualisiert einen Beschluss (Status, Outcome, Quorum, Anhänge).
   * Schreibt Audit-Log mit Snapshot-Diff VOR/NACH.
   */
  async updateDecision(
    decisionId: string,
    actorId: string | null,
    input: UpdateDecisionInput
  ): Promise<BoardDecision> {
    // Snapshot vor Update für Audit-Log
    const before = await this.getDecisionById(decisionId);

    const { data, error } = await supabase
      .from('board_decisions')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', decisionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update decision: ${error.message}`);
    const updated = data as BoardDecision;

    const statusChanged = before?.status !== updated.status;
    const cancelled = updated.status === 'cancelled' && before?.status !== 'cancelled';

    await this.recordChange({
      decisionId,
      action: cancelled ? 'cancelled' : statusChanged ? 'status_changed' : 'updated',
      actorId,
      oldValues: before,
      newValues: updated,
      details: {
        changed_fields: Object.keys(input),
      },
    });

    return updated;
  }

  /**
   * Soft-Close mit automatischer Quorum-Berechnung nach BGB §32.
   *
   * Logik:
   *  • mitgliederversammlung (§32 BGB): "ohne Rücksicht auf die Zahl der
   *    erschienenen Mitglieder beschlussfähig" per Default. Wenn die Satzung
   *    via system_settings.key='mv_quorum_required_pct' ein anderes Quorum
   *    setzt (z.B. 25%), wird das angewandt.
   *  • vorstandsbeschluss / ausschuss / sonderbeschluss: Quorum = Anzahl
   *    'accepted' Einladungen ≥ system_settings.key='board_quorum_min_members'
   *    (Default: 1 für MVP).
   *  • Fallback: mindestens 1 Stimme abgegeben = Quorum garantiert.
   */
  async finalizeDecision(
    decisionId: string,
    outcome: 'approved' | 'rejected' | 'deferred' | 'withdrawn',
    approvedByUserId: string
  ): Promise<BoardDecision> {
    const before = await this.getDecisionById(decisionId);
    if (!before) throw new Error(`Decision ${decisionId} not found`);

    // 1) Quorum berechnen
    const quorumResult = await this.computeQuorum(decisionId, before.decision_type, before.club_id);

    // 2) Tally berechnen
    const { data: votes, error: votesErr } = await supabase
      .from('decision_votes')
      .select('choice')
      .eq('decision_id', decisionId);
    if (votesErr) throw new Error(`Failed to load votes: ${votesErr.message}`);

    const tally = { votes_for: 0, votes_against: 0, votes_abstain: 0 };
    (votes ?? []).forEach((v) => {
      if (v.choice === 'for') tally.votes_for += 1;
      else if (v.choice === 'against') tally.votes_against += 1;
      else if (v.choice === 'abstain') tally.votes_abstain += 1;
    });

    // 3) Persistieren
    const { data, error } = await supabase
      .from('board_decisions')
      .update({
        status: 'completed',
        outcome,
        approved_by: approvedByUserId,
        quorum_met: quorumResult.quorumMet,
        ...tally,
        updated_at: new Date().toISOString(),
      })
      .eq('id', decisionId)
      .select()
      .single();

    if (error) throw new Error(`Failed to finalize decision: ${error.message}`);
    const updated = data as BoardDecision;

    await this.recordChange({
      decisionId,
      action: 'finalized',
      actorId: approvedByUserId,
      oldValues: before,
      newValues: updated,
      details: {
        outcome,
        quorum: quorumResult,
        tally,
      },
    });

    return updated;
  }

  /**
   * Berechnet ob das Quorum für einen Beschluss erfüllt ist.
   *
   * @returns Array mit accepted erforderlich + anwesend
   */
  async computeQuorum(
    decisionId: string,
    decisionType: DecisionType,
    clubId: string
  ): Promise<{
    quorumMet: boolean;
    acceptedCount: number;
    declinedCount: number;
    tentativeCount: number;
    votersCount: number;
    requiredMin: number;
    mode:
      'mv_default_always_quorate' | 'mv_pct_threshold' | 'board_min_members' | 'fallback_one_vote';
  }> {
    // Einladungen laden
    const { data: invitations } = await supabase
      .from('meeting_invitations')
      .select('status')
      .eq('decision_id', decisionId);

    const accepted = (invitations ?? []).filter((i) => i.status === 'accepted').length;
    const declined = (invitations ?? []).filter((i) => i.status === 'declined').length;
    const tentative = (invitations ?? []).filter((i) => i.status === 'tentative').length;

    // Stimmen zählen (mind. 1 abgegebene Stimme = Quorum als absoluter Fallback)
    const { count: votersCount } = await supabase
      .from('decision_votes')
      .select('id', { count: 'exact', head: true })
      .eq('decision_id', decisionId);

    if (decisionType === 'mitgliederversammlung') {
      // BGB §32 Abs. 1: "ohne Rücksicht auf die Zahl der erschienenen Mitglieder
      // beschlussfähig, wenn die Satzung nichts anderes bestimmt."
      // Konfigurierbar via system_settings.key='mv_quorum_required_pct' (0–100).
      const pctSetting = await this.readClubSetting(clubId, 'mv_quorum_required_pct');
      const pct = pctSetting !== null ? parseFloat(pctSetting) : 0;

      if (pct <= 0) {
        // Per Default immer quorate
        return {
          quorumMet: true,
          acceptedCount: accepted,
          declinedCount: declined,
          tentativeCount: tentative,
          votersCount: votersCount ?? 0,
          requiredMin: 0,
          mode: 'mv_default_always_quorate',
        };
      }

      // Sonst: Prozentsatz der anwesenden Mitglieder
      const { count: totalMembers } = await supabase
        .from('user_club_memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('is_active', true);

      const present = accepted + tentative;
      const required = Math.ceil(((totalMembers ?? 0) * pct) / 100);
      return {
        quorumMet: present >= required,
        acceptedCount: accepted,
        declinedCount: declined,
        tentativeCount: tentative,
        votersCount: votersCount ?? 0,
        requiredMin: required,
        mode: 'mv_pct_threshold',
      };
    }

    // Vorstandsbeschluss / Ausschuss / Sonderbeschluss:
    // Konfigurierbar via system_settings.key='board_quorum_min_members'.
    const minSetting = await this.readClubSetting(clubId, 'board_quorum_min_members');
    const requiredMin = minSetting !== null ? parseInt(minSetting, 10) : 1;

    // Akzeptiert ODER (1 Stimme abgegeben als Fallback)
    const quorumMet = accepted >= requiredMin || (votersCount ?? 0) >= 1;
    return {
      quorumMet,
      acceptedCount: accepted,
      declinedCount: declined,
      tentativeCount: tentative,
      votersCount: votersCount ?? 0,
      requiredMin,
      mode: requiredMin === 1 && accepted === 0 ? 'fallback_one_vote' : 'board_min_members',
    };
  }

  /**
   * Wirft eine Stimme ab (Upsert) + Audit-Log.
   */
  async castVote(decisionId: string, voterId: string, input: CastVoteInput): Promise<void> {
    const { error } = await supabase.from('decision_votes').upsert(
      {
        decision_id: decisionId,
        voter_id: voterId,
        choice: input.choice,
        voted_at: new Date().toISOString(),
      },
      { onConflict: 'decision_id,voter_id' }
    );
    if (error) throw new Error(`Failed to cast vote: ${error.message}`);

    await this.recordChange({
      decisionId,
      action: 'vote_cast',
      actorId: voterId,
      details: { choice: input.choice },
    });
  }

  /**
   * Mitglied reagiert auf Einladung + Audit-Log.
   */
  async respondToInvitation(
    decisionId: string,
    memberId: string,
    input: InvitationResponseInput
  ): Promise<MeetingInvitation> {
    const { data, error } = await supabase
      .from('meeting_invitations')
      .update({
        status: input.status,
        response_note: input.response_note ?? null,
        responded_at: new Date().toISOString(),
      })
      .eq('decision_id', decisionId)
      .eq('member_id', memberId)
      .select()
      .single();

    if (error) throw new Error(`Failed to respond to invitation: ${error.message}`);

    await this.recordChange({
      decisionId,
      action: 'invitation_response',
      actorId: memberId,
      details: { status: input.status, response_note: input.response_note ?? null },
    });

    return data as MeetingInvitation;
  }

  /**
   * Liest einen einzelnen Beschluss (interner Helper).
   */
  private async getDecisionById(decisionId: string): Promise<BoardDecision | null> {
    const { data } = await supabase
      .from('board_decisions')
      .select('*')
      .eq('id', decisionId)
      .maybeSingle();
    return (data as BoardDecision) ?? null;
  }

  /**
   * Liest einen Club-Setting-Wert (system_settings Tabelle).
   * Liefert null wenn nicht gesetzt.
   */
  private async readClubSetting(clubId: string, key: string): Promise<string | null> {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('club_id', clubId)
      .eq('key', key)
      .maybeSingle();
    return data?.value ?? null;
  }

  /**
   * Schreibt einen Eintrag in decision_changes (append-only Audit).
   * Holt actor_label_snapshot per users-Lookup (LRU-gecached) für GD-P-R-Kontext.
   * Fehler hier werden nur geloggt — Audit darf Persistenz nicht blockieren.
   */
  private async recordChange(record: ChangeRecord): Promise<void> {
    try {
      const actorLabel = await lookupActorLabel(record.actorId);
      const { error } = await supabase.from('decision_changes').insert({
        decision_id: record.decisionId,
        action: record.action,
        actor_id: record.actorId,
        actor_label_snapshot: actorLabel,
        old_values: (record.oldValues ?? null) as Json,
        new_values: (record.newValues ?? null) as Json,
        details: (record.details ?? null) as Json,
      });
      if (error) {
        log.warn('decision_changes insertion failed', {
          decisionId: record.decisionId,
          action: record.action,
          error: error.message,
        });
      }
    } catch (err) {
      log.warn('decision_changes insert threw', {
        decisionId: record.decisionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const decisionService = DecisionService.getInstance();

/**
 * TEST-ONLY: leert das modul-lokale `actorLabelCache`, damit jeder Vitest-Test
 * frisch startet — sonst persistiert der Cache über die Test-Grenzen hinweg
 * und Lookup-Hits/Misses werden zwischen Tests verschmutzt.
 *
 * NICHT in Produktion aufrufen. In Produktion ist der Cache-Lookup beabsichtigt
 * persistent (PRO Request-Lifetime).
 */
export function __resetForTests(): void {
  actorLabelCache.clear();
}
