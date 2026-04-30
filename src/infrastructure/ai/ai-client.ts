import OpenAI from 'openai';

export interface AIScheduleRequest {
  clubId: string;
  season: {
    type: 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round';
    year: number;
  };
  trainers: Array<{
    id: string;
    name: string;
    specialties: string[];
    maxHoursPerWeek: number;
  }>;
  groups: Array<{
    id: string;
    name: string;
    level: string;
    ageGroup: string;
    memberCount: number;
  }>;
  courts: Array<{
    id: string;
    name: string;
    surface: string;
    hasIndoor: boolean;
  }>;
  constraints: {
    maxTrainerHours: number;
    noDoubleBooking: boolean;
    groupSizeLimits: Record<string, { min: number; max: number }>;
  };
}

export interface AIGeneratedPlan {
  groups: Array<{
    id: string;
    group_id?: string;
    group_ids?: string[];
    day_of_week: number;
    start_time: string;
    trainer_id: string;
    max_participants?: number;
    notes?: string;
  }>;
}

export class AIClient {
  private openai: OpenAI;
  private model: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = 'gpt-4o-mini';
  }

  async generateSchedule(request: AIScheduleRequest): Promise<AIGeneratedPlan> {
    const prompt = this.buildPrompt(request);

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Du bist ein Experte für Tennis-Trainingsplanung. Gib immer valides JSON zurück.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      const parsed = JSON.parse(content) as AIGeneratedPlan;
      this.validatePlan(parsed);
      return parsed;
    } catch (error) {
      console.error('AI generation failed:', error);
      throw new Error(`AI scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(request: AIScheduleRequest): string {
    return `Erstelle einen optimalen Trainingsplan für einen Tennisclub.

Saison: ${request.season.type} ${request.season.year}

Verfügbare Trainer:
${request.trainers.map(t => `- ${t.name} (ID: ${t.id}, Spezialitäten: ${t.specialties.join(', ')}, Max. ${t.maxHoursPerWeek}h/Woche)`).join('\n')}

Trainingsgruppen:
${request.groups.map(g => `- ${g.name} (ID: ${g.id}, Level: ${g.level}, Altersgruppe: ${g.ageGroup}, ${g.memberCount} Mitglieder)`).join('\n')}

Plätze:
${request.courts.map(c => `- ${c.name} (${c.surface}, ${c.hasIndoor ? 'Halle' : 'Freiplatz'})`).join('\n')}

Constraints:
- Maximal ${request.constraints.maxTrainerHours} Stunden pro Trainer/Woche
- Keine Doppelbelegungen von Trainern
- Optimale Gruppengrößen beachten

Erzeuge einen Plan encoded als JSON:
{
  "groups": [
    {
      "id": "unique_session_id",
      "group_id": "group_id_from_above",
      "group_ids": ["alternative_group_ids_if_merged"],
      "day_of_week": 1-7 (Montag=1),
      "start_time": "HH:MM" (24h Format),
      "trainer_id": "trainer_id_from_above",
      "max_participants": number (optional, default 10),
      "notes": "optional_notes"
    }
  ]
}

WICHTIG:
- Nutze nur vorhandene Trainer-IDs und Gruppen-IDs
- Startzeiten im 30-Minuten-Raster (00 oder 30)
- Trainingsdauer: 60-90 Minuten
- Berücksichtige Spezialitäten-Matching (Trainer sollte zur Gruppe passen)
- Vermeide Konflikte: gleicher Trainer zur gleichen Zeit
- Berücksichtige Hallen-/Freiplatz-Nutzung`;
  }

  private validatePlan(plan: AIGeneratedPlan): void {
    if (!plan.groups || !Array.isArray(plan.groups)) {
      throw new Error('Invalid plan: groups must be an array');
    }
    if (plan.groups.length === 0) {
      throw new Error('Invalid plan: at least one group required');
    }

    const requiredFields = ['id', 'day_of_week', 'start_time', 'trainer_id'];
    for (const group of plan.groups) {
      for (const field of requiredFields) {
        if (!(field in group)) {
          throw new Error(`Invalid plan: missing required field '${field}' in group`);
        }
      }

      if (group.day_of_week < 1 || group.day_of_week > 7) {
        throw new Error(`Invalid day_of_week: ${group.day_of_week}`);
      }

      const timeMatch = /^\d{2}:\d{2}$/.exec(group.start_time);
      if (!timeMatch) {
        throw new Error(`Invalid start_time format: ${group.start_time}`);
      }
    }
  }
}
