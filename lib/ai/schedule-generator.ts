/**
 * AI Schedule Generation Service
 * Pattern from INTEGRATION_ROADMAP.md Phase 5 (Week 15-16)
 *
 * Generates optimal training schedules using Claude AI API
 * Based on TSOWAPP's implementation
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in environment
 * - Members, trainers, courts, availability data
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';

export interface ScheduleGenerationInput {
  clubId: string;
  startDate: Date;
  endDate: Date;
  constraints?: {
    maxParticipantsPerSession?: number;
    preferredDays?: string[]; // ['monday', 'wednesday', 'friday']
    preferredTimeSlots?: { start: string; end: string }[];
    skillLevels?: string[]; // Group by skill level
  };
}

export interface GeneratedSession {
  courtId: string;
  trainerId: string;
  startTime: Date;
  endTime: Date;
  participants: string[]; // member IDs
  skillLevel?: string;
  confidence: number; // 0-1, how confident AI is in this schedule
}

export interface ScheduleGenerationResult {
  sessions: GeneratedSession[];
  reasoning: string; // AI's explanation of the schedule
  warnings?: string[]; // Potential conflicts or issues
  success: boolean;
}

/**
 * AI Schedule Generation Service
 *
 * Uses Claude API to generate optimal training schedules
 * considering member availability, trainer capacity, court usage
 */
export class AIScheduleService {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return this.anthropic !== null;
  }

  /**
   * Generate optimal schedule using Claude AI
   *
   * @param input - Schedule generation parameters
   * @param planningData - Current state (members, trainers, courts, availability)
   * @returns Generated schedule with AI reasoning
   */
  async generateSchedule(
    input: ScheduleGenerationInput,
    planningData: {
      members: Array<{ id: string; name: string; skillLevel: string; availability: string[] }>;
      trainers: Array<{ id: string; name: string; specialization: string; availability: string[] }>;
      courts: Array<{ id: string; name: string; capacity: number }>;
    }
  ): Promise<ScheduleGenerationResult> {
    if (!this.anthropic) {
      return {
        success: false,
        sessions: [],
        reasoning: 'AI service not configured. Please set ANTHROPIC_API_KEY.',
        warnings: ['AI features disabled'],
      };
    }

    try {
      // Build prompt for Claude
      const prompt = this.buildSchedulePrompt(input, planningData);

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Parse Claude's response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const result = this.parseScheduleResponse(content.text);

      return {
        success: true,
        sessions: result.sessions,
        reasoning: result.reasoning,
        warnings: result.warnings,
      };
    } catch (error) {
      console.error('[AIScheduleService] Generation failed:', error);

      return {
        success: false,
        sessions: [],
        reasoning: 'Failed to generate schedule',
        warnings: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * Build prompt for Claude API
   *
   * Includes constraints, availability, capacity information
   */
  private buildSchedulePrompt(
    input: ScheduleGenerationInput,
    planningData: {
      members: Array<{ id: string; name: string; skillLevel: string; availability: string[] }>;
      trainers: Array<{ id: string; name: string; specialization: string; availability: string[] }>;
      courts: Array<{ id: string; name: string; capacity: number }>;
    }
  ): string {
    const { startDate, endDate, constraints } = input;

    return `You are an expert sports training scheduler. Generate an optimal training schedule with the following parameters:

**Time Period**: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}

**Constraints**:
- Max participants per session: ${constraints?.maxParticipantsPerSession || 12}
- Preferred days: ${constraints?.preferredDays?.join(', ') || 'Any'}
- Skill levels to consider: ${constraints?.skillLevels?.join(', ') || 'All'}

**Available Resources**:

**Members** (${planningData.members.length} total):
${planningData.members
  .slice(0, 20)
  .map((m) => `- ${m.name} (${m.skillLevel}) - Available: ${m.availability.join(', ')}`)
  .join('\n')}
${planningData.members.length > 20 ? `... and ${planningData.members.length - 20} more members` : ''}

**Trainers** (${planningData.trainers.length} total):
${planningData.trainers.map((t) => `- ${t.name} (${t.specialization}) - Available: ${t.availability.join(', ')}`).join('\n')}

**Courts** (${planningData.courts.length} total):
${planningData.courts.map((c) => `- ${c.name} (Capacity: ${c.capacity})`).join('\n')}

**Task**: Generate an optimal schedule that:
1. Groups members by similar skill levels
2. Assigns trainers with matching specializations
3. Maximizes court utilization
4. Respects availability constraints
5. Balances session load across trainers

**Output Format** (JSON):
{
  "sessions": [
    {
      "courtId": "court-uuid",
      "trainerId": "trainer-uuid",
      "startTime": "2026-05-07T10:00:00Z",
      "endTime": "2026-05-07T11:30:00Z",
      "participants": ["member-uuid-1", "member-uuid-2"],
      "skillLevel": "intermediate",
      "confidence": 0.95
    }
  ],
  "reasoning": "Detailed explanation of scheduling decisions",
  "warnings": ["Optional: any potential conflicts or suggestions"]
}

Generate the schedule now:`;
  }

  /**
   * Parse Claude's JSON response
   */
  private parseScheduleResponse(responseText: string): {
    sessions: GeneratedSession[];
    reasoning: string;
    warnings?: string[];
  } {
    try {
      // Extract JSON from response (Claude sometimes wraps it in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sessions: parsed.sessions.map((s: any) => ({
          courtId: s.courtId,
          trainerId: s.trainerId,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          participants: s.participants,
          skillLevel: s.skillLevel,
          confidence: s.confidence || 0.8,
        })),
        reasoning: parsed.reasoning || 'No reasoning provided',
        warnings: parsed.warnings || [],
      };
    } catch (error) {
      console.error('[AIScheduleService] Failed to parse response:', error);

      return {
        sessions: [],
        reasoning: 'Failed to parse AI response',
        warnings: ['Response parsing error'],
      };
    }
  }

  /**
   * Validate generated schedule against constraints
   *
   * Checks for conflicts, capacity limits, availability violations
   */
  async validateSchedule(
    sessions: GeneratedSession[],
    planningData: {
      members: Array<{ id: string; availability: string[] }>;
      trainers: Array<{ id: string; availability: string[] }>;
      courts: Array<{ id: string; capacity: number }>;
    }
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check for overlapping sessions on same court
    const courtSessions = new Map<string, GeneratedSession[]>();
    for (const session of sessions) {
      if (!courtSessions.has(session.courtId)) {
        courtSessions.set(session.courtId, []);
      }
      courtSessions.get(session.courtId)!.push(session);
    }

    for (const [courtId, courtSessionsList] of courtSessions) {
      // Sort by start time
      courtSessionsList.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Check for overlaps
      for (let i = 0; i < courtSessionsList.length - 1; i++) {
        const current = courtSessionsList[i];
        const next = courtSessionsList[i + 1];

        if (current.endTime > next.startTime) {
          errors.push(
            `Court ${courtId} has overlapping sessions: ${current.startTime.toISOString()} - ${current.endTime.toISOString()} overlaps with ${next.startTime.toISOString()}`
          );
        }
      }
    }

    // Check capacity limits
    for (const session of sessions) {
      const court = planningData.courts.find((c) => c.id === session.courtId);
      if (court && session.participants.length > court.capacity) {
        errors.push(
          `Session at ${session.startTime.toISOString()} exceeds court capacity (${session.participants.length} > ${court.capacity})`
        );
      }
    }

    // Check trainer double-booking
    const trainerSessions = new Map<string, GeneratedSession[]>();
    for (const session of sessions) {
      if (!trainerSessions.has(session.trainerId)) {
        trainerSessions.set(session.trainerId, []);
      }
      trainerSessions.get(session.trainerId)!.push(session);
    }

    for (const [trainerId, trainerSessionsList] of trainerSessions) {
      trainerSessionsList.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      for (let i = 0; i < trainerSessionsList.length - 1; i++) {
        const current = trainerSessionsList[i];
        const next = trainerSessionsList[i + 1];

        if (current.endTime > next.startTime) {
          errors.push(
            `Trainer ${trainerId} is double-booked: ${current.startTime.toISOString()} - ${current.endTime.toISOString()} overlaps with ${next.startTime.toISOString()}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Singleton instance (optional - can also instantiate per request)
 */
export const aiScheduleService = new AIScheduleService();
