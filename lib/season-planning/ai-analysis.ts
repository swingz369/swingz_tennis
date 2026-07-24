// AI analysis for schedule planning – calls AI model for plan review
import type { ScheduleSlot } from './types';

const DNAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;

export interface AIAnalysisInput {
  plan: ScheduleSlot[];
  totalMembers: number;
  totalMembersPlanned: number;
  membersMultipleGroups: number;
  membersNotPlanned: Array<{ name: string }>;
  seasonStart: string;
  seasonEnd: string;
  activeWeeks: number;
  useAI?: boolean;
}

/**
 * Generates an AI-powered analysis of the schedule plan.
 * Falls back gracefully if the AI is unavailable.
 */
export async function generateAIAnalysis(input: AIAnalysisInput): Promise<string> {
  if (!input.useAI) return '';

  const {
    plan,
    totalMembers,
    totalMembersPlanned,
    membersMultipleGroups,
    membersNotPlanned,
    seasonStart,
    seasonEnd,
    activeWeeks,
  } = input;

  try {
    // Datenschutz: Klarnamen (Mitglieder, Trainer) verlassen die App nicht in
    // Richtung Gemini. Trainer werden pro Aufruf pseudonymisiert (damit die
    // Analyse Auslastungs-Muster über Gruppen hinweg noch erkennen kann),
    // Mitgliedernamen werden komplett weggelassen — nur Zählwerte sind nötig.
    const trainerPseudonyms = new Map<string, string>();
    const pseudonymFor = (name: string) => {
      if (!trainerPseudonyms.has(name)) {
        trainerPseudonyms.set(name, `Trainer ${String.fromCharCode(65 + trainerPseudonyms.size)}`);
      }
      return trainerPseudonyms.get(name)!;
    };

    const planSummary = plan
      .slice(0, 15)
      .map(
        (s) =>
          `${s.groupName}: ${DNAMES[s.dayOfWeek]} ${s.startTime} · ${pseudonymFor(s.trainerName)} · ${s.courtName} · ${s.memberNames.length} Teilnehmer`
      )
      .join('\n');

    const userPrompt = `Analysiere diesen automatisch generierten Trainingsplan (max. 150 Wörter auf Deutsch).

PLAN (${plan.length} Gruppen):
${planSummary}${plan.length > 15 ? `\n... und ${plan.length - 15} weitere Gruppen` : ''}

STATISTIK:
- ${totalMembersPlanned} von ${totalMembers} Mitgliedern eingeplant
- ${membersMultipleGroups} Mitglieder trainieren mehrfach pro Woche
- ${membersNotPlanned.length} nicht eingeplant
- Saison: ${seasonStart} bis ${seasonEnd} (${activeWeeks} Trainingswochen)

Bewerte:
1) Sind die Gruppengrößen sinnvoll?
2) Wurden Mehrfach-Trainer-Mitglieder gut verteilt?
3) Was könnte optimiert werden?`;

    const response = await fetch('/api/seasons/planning/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt }),
    });

    if (!response.ok) throw new Error('AI analysis request failed');

    const data = await response.json();
    return data.analysis || '';
  } catch {
    return 'KI-Analyse momentan nicht verfügbar.';
  }
}
