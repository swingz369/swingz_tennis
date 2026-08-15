import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { internalErrorResponse } from '@/lib/api-error';
import { getClubMembersUseCase } from '@/application/members/get-club-members.use-case';
import { DrizzleClubRepository } from '@/infrastructure/persistence/repositories/club.repository';
import { DrizzleMemberRepository } from '@/infrastructure/persistence/repositories/member.repository';
import { withApiAuth, verifyRole, forbiddenResponse } from '@/lib/api-auth';
import { RATE_LIMITS, checkRateLimitOrFail } from '@/lib/rate-limit';

export async function GET(_request: NextRequest) {
  return withApiAuth(_request, async (auth) => {
    // Only admins can view insights
    const hasPermission = await verifyRole(auth, 'admin');
    if (!hasPermission) {
      return forbiddenResponse('Zugriff nur für Admins');
    }

    const rateLimitError = await checkRateLimitOrFail(_request, RATE_LIMITS.STANDARD);
    if (rateLimitError) {
      return rateLimitError;
    }

    const { searchParams } = new URL(_request.url);
    const clubId = searchParams.get('clubId');
    const insightType = searchParams.get('type') || 'churn'; // 'churn' | 'recommendations' | 'all'

    if (!clubId) {
      return NextResponse.json({ error: 'clubId required' }, { status: 400 });
    }

    try {
      const memberRepository = new DrizzleMemberRepository();
      const clubRepository = new DrizzleClubRepository();
      const useCase = getClubMembersUseCase(memberRepository, clubRepository);
      const members = await useCase.execute(clubId);

      // AI insights generation (simplified mock implementation)
      // In production, integrate with OpenAI/ML model for predictions
      const insights = generateInsights(members);

      const result: Record<string, unknown> = {
        success: true,
        clubId,
        generatedAt: new Date().toISOString(),
      };
      if (insightType === 'churn' || insightType === 'all') {
        result.churnPredictions = insights.churnPredictions;
      }
      if (insightType === 'recommendations' || insightType === 'all') {
        result.recommendations = insights.recommendations;
      }

      return NextResponse.json(result);
    } catch (_error) {
      return internalErrorResponse();
    }
  });
}

function generateInsights(
  members: Array<{
    id: string;
    name: string;
    email: string;
    joinDate: string;
    lastVisit?: string;
    visitCount?: number;
  }>
): {
  churnPredictions: Array<{
    memberId: string;
    name: string;
    email: string;
    churnRisk: 'low' | 'medium' | 'high';
    score: number;
    reason: string;
  }>;
  recommendations: Array<{
    memberId: string;
    memberName: string;
    type: string;
    suggestion: string;
    reason: string;
  }>;
} {
  const now = new Date();
  const churnPredictions = members
    .map((m) => {
      const daysSinceLastVisit = m.lastVisit
        ? (now.getTime() - new Date(m.lastVisit).getTime()) / (1000 * 60 * 60 * 24)
        : 9999;

      let churnRisk: 'low' | 'medium' | 'high' = 'low';
      let score = 0;
      let reason = 'Regelmäßige Aktivität';

      if (daysSinceLastVisit > 30) {
        churnRisk = 'high';
        score = 0.85;
        reason = 'Wenig besucht in den letzten 4 Wochen';
      } else if (daysSinceLastVisit > 14) {
        churnRisk = 'medium';
        score = 0.62;
        reason = 'Abnahme der Buchungen';
      } else {
        score = 0.21;
      }

      return { memberId: m.id, name: m.name, email: m.email, churnRisk, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  const recommendations = members.slice(0, 5).map((m) => ({
    memberId: m.id,
    memberName: m.name,
    type: 'training_group',
    suggestion: 'Aktuelle Trainingsgruppe überprüfen und ggf. wechseln',
    reason: 'Optimierung des Trainingserfolgs basierend auf Aktivitätsprofil',
  }));

  return { churnPredictions, recommendations };
}
