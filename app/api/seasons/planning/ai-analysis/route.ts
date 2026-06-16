import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { AI_PROMPTS } from '@/lib/ai-prompts';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:planning:ai-analysis');

const env = process.env;

/**
 * AI Analysis API for season planning
 * Accepts a prompt describing the generated plan and returns an AI analysis.
 * Falls back gracefully if the AI API key is not configured.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');
    if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

    try {
      const body = await request.json();
      const { prompt } = body;

      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
      }

      // Try to use OpenRouter or direct AI API
      const aiKey = env.OPENROUTER_API_KEY || env.OPENAI_API_KEY;
      if (!aiKey) {
        // Graceful fallback — return a placeholder analysis
        return NextResponse.json({
          analysis:
            `Der Trainingsplan wurde automatisch generiert. ` +
            `Eine KI-gestützte Detailanalyse steht aktuell nicht zur Verfügung (kein KI-API-Key konfiguriert). ` +
            `Bitte prüfe die Gruppenzusammensetzung, Trainerzuweisungen und Zeitslots manuell auf Plausibilität.`,
        });
      }

      const isOpenRouter = !!env.OPENROUTER_API_KEY;
      const apiUrl = isOpenRouter
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const model = isOpenRouter
        ? env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
        : env.OPENAI_MODEL || 'gpt-4o-mini';

      const response = await apiFetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiKey}`,
          ...(isOpenRouter
            ? {
                'HTTP-Referer': env.NEXT_PUBLIC_APP_URL || 'https://swingz.cloud',
                'X-Title': 'SwingZ Season Planning',
              }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: AI_PROMPTS.PLAN_ANALYSIS,
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('AI API error', { status: response.status, errorText });
        return NextResponse.json({
          analysis:
            'KI-Analyse konnte nicht abgerufen werden (API-Fehler). Bitte versuche es später erneut.',
        });
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content || '';

      return NextResponse.json({ analysis });
    } catch (error) {
      log.error('AI analysis route error:', error);
      return NextResponse.json({
        analysis: 'KI-Analyse momentan nicht verfügbar.',
      });
    }
  });
}
