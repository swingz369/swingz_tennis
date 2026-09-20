'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Mail, MessageSquare, Newspaper, PenSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollReveal } from '@/components/animations';
import { ChatView } from '@/components/chat/chat-view';
import NewsAnnouncements from '@/components/news-announcements';
import { useUserRole } from '@/hooks/use-user-role';
import { useUserClub, useUserRoles } from '@/hooks/use-user-data';
import { cn } from '@/lib/utils';

const EmailCampaignsClient = dynamic(
  () => import('@/app/(protected)/admin/(gated)/email-campaigns/email-campaigns-client'),
  { ssr: false }
);

const TRIGGER_CLASS =
  'gap-2 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-primary data-[state=active]:shadow-sm';

function ListSkeleton() {
  return (
    <div className="w-full space-y-3 py-8" role="status" aria-label="Wird geladen">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const [section, setSection] = useState<'chats' | 'news'>(
    searchParams.get('section') === 'news' ? 'news' : 'chats'
  );
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();

  const { data: userRoles, isLoading: rolesLoading } = useUserRoles();
  const { isAdmin, isSuperAdmin, isTrainer } = useUserRole(userRoles);
  const { data: clubData } = useUserClub();
  const clubId = clubData?.clubId ?? null;

  useEffect(() => {
    import('@/src/infrastructure/external/supabase/client').then(({ createClient }) =>
      createClient()
        .auth.getUser()
        .then(({ data }) => setUserId(data.user?.id))
    );
  }, []);

  const pageHeader = (
    <ScrollReveal>
      <PageHeader
        title="Nachrichten"
        description="Chats mit Mitgliedern, Trainern und Gruppen"
        actions={[{ label: 'Neuer Chat', icon: PenSquare, onClick: () => setNewChatOpen(true) }]}
      />
    </ScrollReveal>
  );

  const messagesView = (
    <div className="space-y-4">
      <div className="flex gap-1">
        {(
          [
            ['chats', 'Chats', MessageSquare],
            ['news', 'News', Newspaper],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              section === key
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {section === 'news' ? (
        <NewsAnnouncements canManage={isAdmin} />
      ) : (
        <ChatView
          clubId={clubId}
          userId={userId}
          isAdmin={isAdmin}
          canCreateGroup={isAdmin || isSuperAdmin || isTrainer}
          newChatOpen={newChatOpen}
          onNewChatClose={() => setNewChatOpen(false)}
        />
      )}
    </div>
  );

  // Die Rollen kommen per Query nach; bis sie feststehen, kein Layout-Wechsel (Tabs erscheinen sonst nachträglich).
  if (rolesLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <ListSkeleton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        {pageHeader}
        {messagesView}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}
      <Tabs defaultValue="messages" className="space-y-6">
        <TabsList className="h-auto w-full max-w-2xl flex-wrap justify-start gap-1 bg-muted dark:bg-card/5 p-1 rounded-xl">
          <TabsTrigger value="messages" className={TRIGGER_CLASS}>
            <MessageSquare className="h-4 w-4" /> Nachrichten
          </TabsTrigger>
          <TabsTrigger value="campaigns" className={TRIGGER_CLASS}>
            <Mail className="h-4 w-4" /> E-Mail-Kampagnen
          </TabsTrigger>
        </TabsList>
        <TabsContent value="messages">{messagesView}</TabsContent>
        <TabsContent value="campaigns">
          {clubId ? <EmailCampaignsClient clubId={clubId} showHeader={false} /> : <ListSkeleton />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
