import { MatchmakingPanel } from '@/components/ai/matchmaking-panel';

export const metadata = {
  title: 'Matchmaking - SwingZ',
  description: 'KI-gestützte Trainingspartner-Suche',
};

export default function MatchmakingPage() {
  return (
    <div className="p-6">
      <MatchmakingPanel />
    </div>
  );
}
