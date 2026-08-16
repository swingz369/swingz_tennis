import { createServiceClient } from '@/lib/supabase/service';
import { createLogger } from '@/lib/logger';

const log = createLogger('family-auth');

export const ADULT_AGE = 18;

/** Minderjährig = jünger als 18, anhand des Geburtsdatums (authoritative Quelle). */
export function isMinor(dateOfBirth?: string | null): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return false;
  return (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000) < ADULT_AGE;
}

export interface FamilyLink {
  familyGroupId: string | null;
  dateOfBirth: string | null;
}

export type ActAsDecision =
  { allowed: true; effectiveMemberId: string } | { allowed: false; error: string };

/**
 * Reine Entscheidung (testbar ohne DB): darf `actor` für `target` handeln?
 *
 * - gleicher User → immer erlaubt (effective = der User selbst)
 * - sonst: gleiche Familiengruppe UND Handelnder ist volljährig UND Ziel ist minderjährig.
 *
 * Die Rollen-Spalte (`family_accounts.role`) wird bewusst NICHT herangezogen:
 * der Admin-Pfad setzt für alle `member`, sodass sie bedeutungslos geworden ist.
 * Maßgeblich ist das Alter — ein Erwachsener darf die Minderjährigen seiner
 * eigenen Familiengruppe verwalten.
 */
export function decideActAs(
  authUserId: string,
  targetMemberId: string | null | undefined,
  actor: FamilyLink,
  target: FamilyLink
): ActAsDecision {
  if (!targetMemberId || targetMemberId === authUserId) {
    return { allowed: true, effectiveMemberId: authUserId };
  }
  if (!actor.familyGroupId || actor.familyGroupId !== target.familyGroupId) {
    return { allowed: false, error: 'Keine Familienberechtigung für dieses Mitglied' };
  }
  if (isMinor(actor.dateOfBirth)) {
    return {
      allowed: false,
      error: 'Minderjährige können nicht für andere Familienmitglieder buchen',
    };
  }
  if (!isMinor(target.dateOfBirth)) {
    return {
      allowed: false,
      error: 'Nur minderjährige Familienmitglieder können verwaltet werden',
    };
  }
  return { allowed: true, effectiveMemberId: targetMemberId };
}

async function loadFamilyLink(
  db: { from: (table: string) => any },
  userId: string
): Promise<FamilyLink> {
  const { data } = await db
    .from('family_accounts')
    .select('family_group_id, users(date_of_birth)')
    .eq('user_id', userId)
    .maybeSingle();
  const user = Array.isArray(data?.users) ? data.users[0] : data?.users;
  return {
    familyGroupId: data?.family_group_id ?? null,
    dateOfBirth: user?.date_of_birth ?? null,
  };
}

/**
 * Löst auf, für wen ein Request wirken soll. `targetMemberId` wird nur dann
 * akzeptiert, wenn er zum authentifizierten User gehört ODER eine erlaubte
 * Familienbeziehung (Erwachsener → Minderjähriger derselben Gruppe) besteht.
 * Andernfalls wird `effectiveMemberId = authUserId` gesetzt und eine deutsche
 * Fehlermeldung geliefert, die der Aufrufer als 403 zurückgeben sollte.
 */
export async function resolveEffectiveMemberId(
  authUserId: string,
  targetMemberId?: string | null
): Promise<{ effectiveMemberId: string; error: string | null }> {
  if (!targetMemberId || targetMemberId === authUserId) {
    return { effectiveMemberId: authUserId, error: null };
  }

  try {
    const db = createServiceClient() as any;
    const [actor, target] = await Promise.all([
      loadFamilyLink(db, authUserId),
      loadFamilyLink(db, targetMemberId),
    ]);
    const decision = decideActAs(authUserId, targetMemberId, actor, target);
    if (decision.allowed) {
      return { effectiveMemberId: decision.effectiveMemberId, error: null };
    }
    return { effectiveMemberId: authUserId, error: decision.error };
  } catch (err) {
    log.error('resolveEffectiveMemberId failed', err instanceof Error ? err : undefined);
    return { effectiveMemberId: authUserId, error: 'Familienprüfung fehlgeschlagen' };
  }
}
