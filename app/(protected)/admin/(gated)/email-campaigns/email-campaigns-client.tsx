'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Mail,
  History,
  Users,
  GraduationCap,
  UserCheck,
  Search,
  X,
  Check,
  ChevronsUpDown,
  Loader2,
  Send,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateTime } from '@/lib/format';

interface ClubMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
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

type RecipientMode = 'individual' | 'multi' | 'all' | 'trainers';

export default function EmailCampaignsClient({
  clubId,
  showHeader = true,
}: {
  clubId: string;
  showHeader?: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  // Recipient selection — mirrors the "Neue Nachricht" dialog of the
  // Nachrichten tab so both feel the same (mode buttons + searchable
  // multi-select with quick actions instead of the old checkbox list).
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('all');
  const [receiverId, setReceiverId] = useState('');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Load members once the user picks a mode that needs an explicit list.
  useEffect(() => {
    if (recipientMode !== 'individual' && recipientMode !== 'multi') return;
    if (members.length > 0 || membersLoading) return;
    setMembersLoading(true);
    apiFetch('/api/members?active=true&limit=200')
      .then((res) => res.json())
      .then((data) => {
        const items: ClubMember[] = (data.members ?? []).map((m: any) => ({
          id: m.userId ?? m.id,
          full_name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
          email: m.email,
          role: m.role ?? 'member',
        }));
        setMembers(items);
      })
      .catch(() => toast.error('Mitglieder konnten nicht geladen werden'))
      .finally(() => setMembersLoading(false));
  }, [recipientMode, members.length, membersLoading]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!memberDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMemberDropdownOpen(false);
        setMemberSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [memberDropdownOpen]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast.error('Betreff und Inhalt erforderlich');
      return;
    }
    if (recipientMode === 'individual' && !receiverId) {
      toast.error('Bitte wähle einen Empfänger');
      return;
    }
    if (recipientMode === 'multi' && selectedIds.length === 0) {
      toast.error('Bitte wähle mindestens einen Empfänger');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        subject: subject.trim(),
        body: body.trim(),
        clubId,
      };
      if (recipientMode === 'individual') {
        payload.memberIds = [receiverId];
      } else if (recipientMode === 'multi') {
        payload.memberIds = selectedIds;
      } else if (recipientMode === 'trainers') {
        payload.targetGroup = 'trainers';
      } else {
        payload.targetGroup = 'all';
      }

      const res = await apiFetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message ?? 'Kampagne gesendet');
        setSubject('');
        setBody('');
        setSelectedIds([]);
        setReceiverId('');
        fetchCampaigns();
      } else {
        toast.error(d.error ?? 'Fehler beim Versenden');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {showHeader && (
        <PageHeader
          title="E-Mail-Kampagnen"
          description="Versende E-Mails an Mitglieder und Trainer"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Neue Kampagne
          </CardTitle>
          <CardDescription>Wähle die Empfänger aus und verfasse die E-Mail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Recipient mode */}
          <div className="space-y-2">
            <Label>Empfänger</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={recipientMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRecipientMode('individual');
                  setSelectedIds([]);
                }}
                className="gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Einzeln
              </Button>
              <Button
                variant={recipientMode === 'multi' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setRecipientMode('multi');
                  setReceiverId('');
                }}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Mehrere
              </Button>
              <Button
                variant={recipientMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientMode('all')}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Alle Mitglieder
              </Button>
              <Button
                variant={recipientMode === 'trainers' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRecipientMode('trainers')}
                className="gap-1.5"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Nur Trainer
              </Button>
            </div>
          </div>

          {/* Individual recipient select */}
          {recipientMode === 'individual' && (
            <div className="space-y-2">
              <Label>Empfänger auswählen</Label>
              {membersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade Mitglieder...
                </div>
              ) : (
                <Select value={receiverId} onValueChange={setReceiverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Empfänger auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name} ({m.role === 'trainer' ? 'Trainer' : 'Mitglied'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Multi-recipient select */}
          {recipientMode === 'multi' && (
            <div className="space-y-2">
              <Label>Empfänger auswählen</Label>
              {membersLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Lade Mitglieder...
                </div>
              ) : (
                <>
                  {selectedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedIds.map((id) => {
                        const member = members.find((m) => m.id === id);
                        if (!member) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
                          >
                            {member.full_name}
                            <button
                              type="button"
                              onClick={() => toggleSelected(id)}
                              className="hover:bg-primary/20 rounded-md p-0.5"
                              aria-label={`${member.full_name} entfernen`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Alle entfernen
                      </button>
                    </div>
                  )}

                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setMemberDropdownOpen(!memberDropdownOpen)}
                      className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-muted-foreground">
                        {selectedIds.length > 0
                          ? `${selectedIds.length} ausgewählt`
                          : 'Mitglieder suchen & auswählen...'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                    </button>

                    {memberDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background shadow-lg">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Name, E-Mail oder Rolle suchen..."
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              className="border-0 bg-muted/50 pl-8 pr-3 py-1.5 h-8 text-sm focus-visible:ring-1"
                              // eslint-disable-next-line jsx-a11y/no-autofocus -- search input needs focus on dropdown open
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIds(
                                members.filter((m) => m.role === 'member').map((m) => m.id)
                              )
                            }
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors font-medium text-primary"
                          >
                            <Users className="h-4 w-4" />
                            Alle Mitglieder auswählen
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIds(
                                members.filter((m) => m.role === 'trainer').map((m) => m.id)
                              )
                            }
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors font-medium text-primary"
                          >
                            <GraduationCap className="h-4 w-4" />
                            Alle Trainer auswählen
                          </button>
                          <div className="h-px bg-border my-1" />

                          {filteredMembers.map((m) => {
                            const isSelected = selectedIds.includes(m.id);
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleSelected(m.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md hover:bg-muted transition-colors ${
                                  isSelected ? 'bg-primary/5' : ''
                                }`}
                              >
                                <div
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                    isSelected
                                      ? 'bg-primary border-primary text-primary-foreground'
                                      : 'border-border'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                </div>
                                <span className="flex-1 truncate">{m.full_name}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {m.role === 'trainer' ? 'Trainer' : 'Mitglied'}
                                </span>
                              </button>
                            );
                          })}
                          {filteredMembers.length === 0 && (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                              Keine Mitglieder gefunden
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Broadcast info */}
          {recipientMode === 'all' && (
            <div className="rounded-xl bg-info-50 border border-info-200 px-3 py-2 text-sm text-info-800">
              📣 E-Mail wird an alle aktiven Vereinsmitglieder gesendet.
            </div>
          )}
          {recipientMode === 'trainers' && (
            <div className="rounded-xl bg-info-50 border border-info-200 px-3 py-2 text-sm text-info-800">
              📣 E-Mail wird an alle Trainer des Vereins gesendet.
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

          {/* Send button */}
          <div className="flex justify-end border-t border-border pt-5">
            <Button onClick={handleSend} disabled={loading} className="gap-1.5">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {loading ? 'Wird versendet...' : 'Kampagne versenden'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Verlauf
          </CardTitle>
          <CardDescription>Zuletzt versendete Kampagnen.</CardDescription>
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
