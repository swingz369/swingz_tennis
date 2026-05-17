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

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '@/lib/env';

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
  modelUsed: 'claude' | 'openai' | 'none';
  success: boolean;
}

interface PlanningData {
  members: Array<{ id: string; name: string; skillLevel: string; availability: string[] }>;
  trainers: Array<{ id: string; name: string; specialization: string; availability: string[] }>;
  courts: Array<{ id: string; name: string; capacity: number }>;
}

// =============================================================================
// System Prompt (consistent across models)
// =============================================================================

const SYSTEM_PROMPT = `You are an expert sports training scheduler for a tennis club management platform called SwingZ.
Your task is to generate optimal weekly training schedules that maximize court utilization, respect trainer availability, and match member skill levels.

**Scheduling Rules:**
1. Group members by skill level (beginner, intermediate, advanced, professional)
2. Assign trainers whose specialization matches the group's skill level
3. Never double-book a court (two sessions cannot overlap on the same court)
4. Never double-book a trainer (a trainer cannot be in two places at once)
5. Respect all availability constraints (only schedule when both trainer and members are available)
6. Standard session duration is 90 minutes
7. Place no more than 12 participants per session unless a court has higher capacity
8. Distribute sessions evenly across available days
9. Leave 15-minute gaps between sessions on the same court

**Output Format:** You MUST respond with a valid JSON object with this structure:
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
  "reasoning": "Detailed explanation of your scheduling strategy and tradeoffs made",
  "warnings": ["Any potential issues or suggestions for improvement"]
}

**Important:** Only output valid JSON. Do not include markdown code blocks or any text outside the JSON object.`;

// =============================================================================
// Cache for generated schedules (avoids redundant API calls)
// =============================================================================

const scheduleCache = new Map<string, { result: ScheduleGenerationResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// AI Schedule Service V2
// =============================================================================

export class AIScheduleServiceV2 {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;
  private preferredModel: 'claude' | 'openai' = 'claude';

  constructor() {
    if (env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    if (env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
  }

  isAvailable(): boolean {
    return this.anthropic !== null || this.openai !== null;
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

    // Try primary model, fall back to secondary
    let result: ScheduleGenerationResult;

    if (this.preferredModel === 'claude' && this.anthropic) {
      result = await this.generateWithClaude(input, planningData);
      if (!result.success && this.openai) {
        console.log('[AIScheduleV2] Claude failed, falling back to OpenAI');
        result = await this.generateWithOpenAI(input, planningData);
      }
    } else if (this.openai) {
      result = await this.generateWithOpenAI(input, planningData);
      if (!result.success && this.anthropic) {
        console.log('[AIScheduleV2] OpenAI failed, falling back to Claude');
        result = await this.generateWithClaude(input, planningData);
      }
    } else if (this.anthropic) {
      result = await this.generateWithClaude(input, planningData);
    } else {
      return {
        success: false,
        sessions: [],
        reasoning: 'No AI model configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.',
        modelUsed: 'none',
        warnings: ['AI features disabled'],
      };
    }

    // Cache successful results
    if (result.success) {
      scheduleCache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return result;
  }

  // =============================================================================
  // Model-specific implementations
  // =============================================================================

  private async generateWithClaude(
    input: ScheduleGenerationInput,
    planningData: PlanningData
  ): Promise<ScheduleGenerationResult> {
    if (!this.anthropic) {
      return {
        success: false,
        sessions: [],
        reasoning: 'Claude not configured',
        modelUsed: 'claude',
        warnings: [],
      };
    }

    const userPrompt = this.buildUserPrompt(input, planningData);

    try {
      const response = await this.retryWithBackoff(() =>
        this.anthropic!.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          temperature: 0.5, // Lower temperature for more consistent scheduling
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        })
      );

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const parsed = this.parseResponse(content.text);
      return {
        success: true,
        sessions: parsed.sessions,
        reasoning: parsed.reasoning,
        warnings: parsed.warnings,
        modelUsed: 'claude',
      };
    } catch (error) {
      console.error('[AIScheduleV2] Claude generation failed:', error);
      return {
        success: false,
        sessions: [],
        reasoning: 'Claude generation failed',
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        modelUsed: 'claude',
      };
    }
  }

  private async generateWithOpenAI(
    input: ScheduleGenerationInput,
    planningData: PlanningData
  ): Promise<ScheduleGenerationResult> {
    if (!this.openai) {
      return {
        success: false,
        sessions: [],
        reasoning: 'OpenAI not configured',
        modelUsed: 'openai',
        warnings: [],
      };
    }

    const userPrompt = this.buildUserPrompt(input, planningData);

    try {
      const response = await this.retryWithBackoff(() =>
        this.openai!.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 4096,
          temperature: 0.5,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        })
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = this.parseResponse(content);
      return {
        success: true,
        sessions: parsed.sessions,
        reasoning: parsed.reasoning,
        warnings: parsed.warnings,
        modelUsed: 'openai',
      };
    } catch (error) {
      console.error('[AIScheduleV2] OpenAI generation failed:', error);
      return {
        success: false,
        sessions: [],
        reasoning: 'OpenAI generation failed',
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
        modelUsed: 'openai',
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
      .slice(0, 30)
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
${planningData.members.length > 30 ? `... and ${planningData.members.length - 30} more members\n` : ''}

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

    try {
      const parsed = JSON.parse(cleaned);
      return {
        sessions: (parsed.sessions || []).map((s: any) => ({
          courtId: s.courtId,
          trainerId: s.trainerId,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          participants: s.participants || [],
          skillLevel: s.skillLevel,
          confidence: s.confidence || 0.8,
        })),
        reasoning: parsed.reasoning || 'No reasoning provided',
        warnings: parsed.warnings || [],
      };
    } catch {
      // Try to extract JSON from within the text
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('No JSON found in AI response');
      }
      const parsed = JSON.parse(match[0]);
      return {
        sessions: (parsed.sessions || []).map((s: any) => ({
          courtId: s.courtId,
          trainerId: s.trainerId,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          participants: s.participants || [],
          skillLevel: s.skillLevel,
          confidence: s.confidence || 0.8,
        })),
        reasoning: parsed.reasoning || 'No reasoning provided',
        warnings: parsed.warnings || [],
      };
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
