/**
 * Enhanced AI Schedule Generation Service V2
 *
 * Improvements over V1:
 * 1. Multi-model support (Anthropic Claude + OpenAI fallback)
 * 2. Better prompt engineering with structured output requirements
 * 3. Temperature tuning for creative vs deterministic scheduling
 * 4. Retry logic with exponential backoff
 * 5. Result caching to avoid redundant API calls
 * 6. Streaming support for real-time feedback
 */

// Google Gemini via OpenAI-compatible endpoint — kein extra Package nötig
import { env } from '@/lib/env';
import { AI_PROMPTS } from '@/lib/ai-prompts';
import { createLogger } from '@/lib/logger';

const log = createLogger('ai:schedule-generator');

// =============================================================================
// Types
// =============================================================================

export interface ScheduleGenerationInput {
  clubId: string;
  startDate: Date;
  endDate: Date;
  constraints?: {
    maxParticipantsPerSession?: number;
    preferredDays?: string[];
    preferredTimeSlots?: { start: string; end: string }[];
    skillLevels?: string[];
    avoidTrainerOverload?: boolean;
    balanceGroupSizes?: boolean;
  };
}

export interface GeneratedSession {
  courtId: string;
  trainerId: string;
  startTime: Date;
  endTime: Date;
  participants: string[];
  skillLevel?: string;
  confidence: number;
}

export interface ScheduleGenerationResult {
  sessions: GeneratedSession[];
  reasoning: string;
  warnings?: string[];
  modelUsed: 'gemini' | 'none';
  success: boolean;
}

interface PlanningData {
  members: Array<{ id: string; name: string; skillLevel: string; availability: string[] }>;
  trainers: Array<{ id: string; name: string; specialization: string; availability: string[] }>;
  courts: Array<{ id: string; name: string; capacity: number }>;
}

/** Raw shape of a session as returned by the AI model (before mapping to GeneratedSession) */
interface RawAiSession {
  courtId?: unknown;
  trainerId?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  participants?: unknown;
  skillLevel?: unknown;
  confidence?: unknown;
}

/** Raw shape of the AI response object */
interface RawAiResponse {
  sessions?: unknown;
  reasoning?: unknown;
  warnings?: unknown;
}

// =============================================================================
// System Prompt (consistent across models)
// =============================================================================

const SYSTEM_PROMPT =
  AI_PROMPTS.SCHEDULE_GENERATION +
  `

**Output Format:** You MUST respond with a valid JSON object starting with '{' on the very first line — no markdown, no explanation outside JSON:
{
  "sessions": [
    {
      "courtId": "court-uuid",
      "trainerId": "trainer-uuid",
      "startTime": "YYYY-MM-DDTHH:MM:SS",
      "endTime": "YYYY-MM-DDTHH:MM:SS",
      "participants": ["member-uuid-1"],
      "skillLevel": "intermediate",
      "confidence": 0.95
    }
  ],
  "reasoning": "Detailed explanation of your scheduling strategy and tradeoffs made (IN GERMAN)",
  "warnings": ["Any potential issues or suggestions for improvement (IN GERMAN)"]
}`;

// =============================================================================
// Cache for generated schedules (avoids redundant API calls)
// =============================================================================

const scheduleCache = new Map<string, { result: ScheduleGenerationResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// AI Schedule Service V2
// =============================================================================

export class AIScheduleServiceV2 {
  private geminiKey: string | null = null;

  constructor() {
    this.geminiKey = env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
  }

  isAvailable(): boolean {
    return this.geminiKey !== null;
  }

  // =============================================================================
  // Public API
  // =============================================================================

  async generateSchedule(
    input: ScheduleGenerationInput,
    planningData: PlanningData
  ): Promise<ScheduleGenerationResult> {
    // Check cache
    const cacheKey = this.buildCacheKey(input, planningData);
    const cached = scheduleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.result,
        warnings: [...(cached.result.warnings || []), '⚠️ Cached result'],
      };
    }

    if (!this.geminiKey) {
      return {
        success: false,
        sessions: [],
        reasoning: 'Kein KI-Modell konfiguriert. GOOGLE_GENERATIVE_AI_API_KEY setzen.',
        modelUsed: 'none',
        warnings: ['KI-Features deaktiviert'],
      };
    }

    const result = await this.generateWithGemini(input, planningData);

    // Cache successful results
    if (result.success) {
      scheduleCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;
  }

  // =============================================================================
  // Model-specific implementations
  // =============================================================================

  private async generateWithGemini(
    input: ScheduleGenerationInput,
    planningData: PlanningData
  ): Promise<ScheduleGenerationResult> {
    const userPrompt = this.buildUserPrompt(input, planningData);

    try {
      const res = await this.retryWithBackoff(() =>
        fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.geminiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.0-flash',
            max_tokens: 4096,
            temperature: 0.5,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          }),
        })
      );

      if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Leere Antwort von Gemini');

      const parsed = this.parseResponse(content);
      return {
        success: true,
        sessions: parsed.sessions,
        reasoning: parsed.reasoning,
        warnings: parsed.warnings,
        modelUsed: 'gemini',
      };
    } catch (error) {
      log.error('Gemini generation failed', error instanceof Error ? error : undefined);
      return {
        success: false,
        sessions: [],
        reasoning: 'Gemini generation failed',
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        modelUsed: 'gemini',
      };
    }
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  private buildCacheKey(input: ScheduleGenerationInput, planningData: PlanningData): string {
    const key = JSON.stringify({
      clubId: input.clubId,
      start: input.startDate.toISOString(),
      end: input.endDate.toISOString(),
      memberIds: planningData.members
        .map((m) => m.id)
        .sort()
        .join(','),
      trainerIds: planningData.trainers
        .map((t) => t.id)
        .sort()
        .join(','),
      courtIds: planningData.courts
        .map((c) => c.id)
        .sort()
        .join(','),
      constraints: input.constraints,
    });
    return key;
  }

  private buildUserPrompt(input: ScheduleGenerationInput, planningData: PlanningData): string {
    const { startDate, endDate, constraints } = input;

    const memberSummary = planningData.members
      .map(
        (m) => `- ${m.name} (${m.skillLevel}) — Available: ${m.availability.join(', ') || 'Any'}`
      )
      .join('\n');

    const trainerSummary = planningData.trainers
      .map(
        (t) =>
          `- ${t.name} (${t.specialization}) — Available: ${t.availability.join(', ') || 'Any'}`
      )
      .join('\n');

    const courtSummary = planningData.courts
      .map((c) => `- ${c.name} (Capacity: ${c.capacity})`)
      .join('\n');

    return `Generate an optimal tennis training schedule.

**Time Period:** ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}
**Max Participants per Session:** ${constraints?.maxParticipantsPerSession || 12}
**Preferred Days:** ${constraints?.preferredDays?.join(', ') || 'All days'}
**Skill Levels to Group:** ${constraints?.skillLevels?.join(', ') || 'All levels'}
**Avoid Trainer Overload:** ${constraints?.avoidTrainerOverload !== false ? 'Yes' : 'No'}
**Balance Group Sizes:** ${constraints?.balanceGroupSizes !== false ? 'Yes' : 'No'}

**Members (${planningData.members.length} total):**
${memberSummary}

**Trainers (${planningData.trainers.length} total):**
${trainerSummary}

**Courts (${planningData.courts.length} total):**
${courtSummary}

Generate the schedule now. Remember: output ONLY valid JSON, no markdown.`;
  }

  private parseResponse(text: string): {
    sessions: GeneratedSession[];
    reasoning: string;
    warnings?: string[];
  } {
    // Strip any markdown code blocks
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const mapSession = (s: unknown): GeneratedSession => {
      const raw = s as RawAiSession;
      return {
        courtId: typeof raw.courtId === 'string' ? raw.courtId : '',
        trainerId: typeof raw.trainerId === 'string' ? raw.trainerId : '',
        startTime:
          typeof raw.startTime === 'string' || raw.startTime instanceof Date
            ? new Date(raw.startTime as string | Date)
            : new Date(0),
        endTime:
          typeof raw.endTime === 'string' || raw.endTime instanceof Date
            ? new Date(raw.endTime as string | Date)
            : new Date(0),
        participants: Array.isArray(raw.participants)
          ? (raw.participants as unknown[]).filter((p): p is string => typeof p === 'string')
          : [],
        skillLevel: typeof raw.skillLevel === 'string' ? raw.skillLevel : undefined,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.8,
      };
    };

    const buildResult = (parsed: unknown) => {
      const raw = (parsed ?? {}) as RawAiResponse;
      const sessions = Array.isArray(raw.sessions)
        ? (raw.sessions as unknown[]).map(mapSession)
        : [];
      return {
        sessions,
        reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : 'No reasoning provided',
        warnings: Array.isArray(raw.warnings)
          ? (raw.warnings as unknown[]).filter((w): w is string => typeof w === 'string')
          : [],
      };
    };

    try {
      return buildResult(JSON.parse(cleaned));
    } catch {
      // Try to extract JSON from within the text
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('No JSON found in AI response');
      }
      return buildResult(JSON.parse(match[0]));
    }
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[AIScheduleV2] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }
}

// Singleton instance
export const aiScheduleServiceV2 = new AIScheduleServiceV2();
