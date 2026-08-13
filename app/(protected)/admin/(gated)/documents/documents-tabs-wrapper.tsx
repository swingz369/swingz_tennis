'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { FileText, CalendarClock, Gavel } from 'lucide-react';
import type { BoardDecision, DecisionVote, MeetingInvitation } from '@/lib/types/decisions';

const MeetingsClient = dynamic(
  () => import('../meetings/meetings-client').then((m) => ({ default: m.MeetingsClient })),
  { ssr: false }
);
const DecisionsClient = dynamic(
  () => import('../decisions/decisions-client').then((m) => ({ default: m.DecisionsClient })),
  { ssr: false }
);

type DocumentsTab = 'documents' | 'meetings' | 'decisions';

const tabs: {
  id: DocumentsTab;
  label: string;
  icon: React.ComponentType<{ className?: string | undefined }>;
}[] = [
  { id: 'documents', label: 'Dokumente', icon: FileText },
  { id: 'meetings', label: 'Versammlungen', icon: CalendarClock },
  { id: 'decisions', label: 'Board-Beschlüsse', icon: Gavel },
];

export function DocumentsTabsWrapper({
  children,
  initialDecisions,
  initialVotes,
  initialInvitations,
}: {
  children: React.ReactNode;
  initialDecisions: BoardDecision[];
  initialVotes: DecisionVote[];
  initialInvitations: Pick<MeetingInvitation, 'decision_id' | 'status' | 'member_id'>[];
}) {
  const [activeTab, setActiveTab] = useState<DocumentsTab>('documents');

  return (
    <div className="space-y-6">
      <div>
        <div className="flex gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                activeTab === tab.id
                  ? 'bg-background dark:bg-surface-dark text-brand-primary shadow-sm'
                  : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'documents' && children}
      {activeTab === 'meetings' && <MeetingsClient />}
      {activeTab === 'decisions' && (
        <DecisionsClient
          initialDecisions={initialDecisions}
          initialVotes={initialVotes}
          initialInvitations={initialInvitations}
        />
      )}
    </div>
  );
}
