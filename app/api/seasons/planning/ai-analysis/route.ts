import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { getClubFeatures, featureDisabledResponse } from '@/lib/require-feature';
import { AI_PROMPTS } from '@/lib/ai-prompts';
import { apiFetch } from '@/lib/api-fetch';
import { createLogger } from '@/lib/logger';

const log = createLogger('api:seasons:planning:ai-analysis');

const env = process.env;

/**
 * AI Analysis API for season planning
 *
 * Tier-4 (Audit): Server-side Premium-Gate in Ergänzung zum Client-seitigen
 * `premium-upsell.tsx`. Der Client-Upsell allein reicht NICHT, weil Admins
 * den Endpoint direkt per `curl` aufrufen könnten — daher prüfen wir
 * serverseitig, ob `clubs.features.ai_analysis` aktiviert ist.
 *
 * Akzeptiert einen Prompt, der den generierten Plan beschreibt, und gibt
 * eine KI-Analyse zurück. Falls der GOOGLE_GENERATIVE_AI_API_KEY fehlt,
 * fällt der Endpoint graceful auf einen statischen Text zurück.
 */
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (auth) => {
    const isAdmin = await verifyRole(auth, 'admin');
    const isSuperadmin = await verifyRole(auth, 'superadmin');
    if (!isAdmin && !isSuperadmin) return forbiddenResponse('Nur Admins');

    // Server-side feature gate. Ohne aktives Modul → 403 auch für Admins.
    // Owner/Superadmin dürfen die KI unabhängig vom Modul-Status nutzen
    // (Plattform-Rolle — sie haben ohnehin globale Sicht auf alle Clubs
    // und müssen KI zur Diagnose einsetzen können).
    if (!isSuperadmin) {
      if (!auth.clubId) {
        return forbiddenResponse('KI-Analyse nur mit aktivem Vereins-Kontext verfügbar');
      }
      const features = await getClubFeatures(auth.supabase, auth.clubId);
      if (!features.ai_analysis) {
        return featureDisabledResponse('ai_analysis');
      }
    }

    try {
      const body = await request.json();
      const { prompt } = body;

      if (!prompt || typeof prompt !== 'string') {
        return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
      }

      // Google Gemini Flash — kostenlos, OpenAI-kompatibler Endpoint
      const aiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!aiKey) {
        return NextResponse.json({
          analysis:
            'Der Trainingsplan wurde automatisch generiert. ' +
            'KI-Analyse nicht verfügbar (GOOGLE_GENERATIVE_AI_API_KEY nicht konfiguriert).',
        });
      }

      const response = await apiFetch(
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${aiKey}` },
          body: JSON.stringify({
            model: 'gemini-2.0-flash',
            messages: [
              { role: 'system', content: AI_PROMPTS.PLAN_ANALYSIS },
              { role: 'user', content: prompt },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        }
      );

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
