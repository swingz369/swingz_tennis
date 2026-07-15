'use client';

import { MatchmakingPanel } from '@/components/ai/matchmaking-panel';
import { ScrollReveal } from '@/components/animations';
import { PageHeader } from '@/components/ui/page-header';

export default function MatchmakingPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          KI-gestützt
        </p>
        <PageHeader
          title="Matchmaking"
          description="Finde Trainingspartner mit passendem Level und gemeinsamen Interessen"
        />
      </div>

      <ScrollReveal delay={100}>
        <MatchmakingPanel />
      </ScrollReveal>
    </div>
  );
}
