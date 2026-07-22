'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Mail, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';

interface ClubMember {
  id: string;
  name: string;
  email: string;
}

interface Campaign {
  id: string;
  subject: string;
  target_group: string;
  recipient_count: number;
  status: string;
  created_at: string;
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  queued: 'In Warteschlange',
  sending: 'Wird versendet',
  sent: 'Versendet',
  failed: 'Fehlgeschlagen',
};

const CAMPAIGN_STATUS_TONE: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  queued: 'warning',
  sending: 'warning',
  sent: 'success',
  failed: 'error',
};

const CAMPAIGN_TARGET_LABEL: Record<string, string> = {
  all: 'Alle',
  members: 'Mitglieder',
  trainers: 'Trainer',
  custom: 'Ausgewählt',
};

export default function EmailCampaignsClient({ clubId }: { clubId: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetGroup, setTargetGroup] = useState<'all' | 'members' | 'trainers' | 'individual'>(
    'all'
  );
  const [loading, setLoading] = useState(false);

  // Individual recipient selection
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign history
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  const fetchCampaigns = useCallback(() => {
    setCampaignsLoading(true);
    apiFetch('/api/email-campaigns')
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data) => setCampaigns(data.campaigns ?? []))
      .catch(() => toast.error('Kampagnen-Verlauf konnte nicht geladen werden'))
      .finally(() => setCampaignsLoading(false));
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  function handleTargetChange(v: typeof targetGroup) {
    setTargetGroup(v);
    if (v === 'individual' && members.length === 0) {
      setMembersLoading(true);
      apiFetch('/api/members?active=true&limit=200')
        .then((res) => res.json())
        .then((data) => {
          const items: ClubMember[] = (data.members ?? []).map((m: any) => ({
            id: m.userId ?? m.id,
            name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
            email: m.email,
          }));
          setMembers(items);
        })
        .catch(() => toast.error('Mitglieder konnten nicht geladen werden'))
        .finally(() => setMembersLoading(false));
    }
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!subject || !body) {
      toast.error('Betreff und Inhalt erforderlich');
      return;
    }
    if (targetGroup === 'individual' && selectedIds.size === 0) {
      toast.error('Mindestens ein Empfänger auswählen');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          targetGroup: targetGroup === 'individual' ? undefined : targetGroup,
          memberIds: targetGroup === 'individual' ? Array.from(selectedIds) : undefined,
          clubId,
        }),
      });
      if (res.ok) {
        toast.success('Kampagne wird versendet');
        setSubject('');
        setBody('');
        setSelectedIds(new Set());
        fetchCampaigns();
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Fehler beim Versenden');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="E-Mail-Kampagnen"
        description="Versende E-Mails an Mitglieder und Trainer"
        breadcrumbs={[{ label: 'E-Mail-Kampagnen' }]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Neue Kampagne
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="target">Empfänger</Label>
            <Select
              value={targetGroup}
              onValueChange={(v) => handleTargetChange(v as typeof targetGroup)}
            >
              <SelectTrigger id="target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="members">Nur Mitglieder</SelectItem>
                <SelectItem value="trainers">Nur Trainer</SelectItem>
                <SelectItem value="individual">Einzeln auswählen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetGroup === 'individual' && (
            <div className="space-y-2">
              <Input
                placeholder="Mitglied suchen…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-xl p-2">
                {membersLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Lade Mitglieder…</p>
                ) : filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
                ) : (
                  filteredMembers.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => toggleSelected(m.id)}
                      />
                      <span className="text-sm">{m.name}</span>
                    </label>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedIds.size} ausgewählt</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="subject">Betreff</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff der E-Mail"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Inhalt</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="E-Mail-Text..."
            />
          </div>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? 'Wird versendet...' : 'Kampagne versenden'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Verlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Lade Verlauf…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Kampagnen versendet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {CAMPAIGN_TARGET_LABEL[c.target_group] ?? c.target_group} ·{' '}
                      {c.recipient_count} Empfänger · {formatDateTime(c.created_at)}
                    </p>
                  </div>
                  <Badge variant={CAMPAIGN_STATUS_TONE[c.status] ?? 'default'} className="shrink-0">
                    {CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
