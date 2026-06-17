'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

export default function EmailCampaignsClient({ clubId }: { clubId: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [targetGroup, setTargetGroup] = useState<'all' | 'members' | 'trainers'>('all');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!subject || !body) {
      toast.error('Betreff und Inhalt erforderlich');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/email-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, targetGroup, clubId }),
      });
      if (res.ok) {
        toast.success('Kampagne wird versendet');
        setSubject('');
        setBody('');
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
      <div>
        <h1 className="text-2xl font-bold">E-Mail-Kampagnen</h1>
        <p className="text-muted-foreground">Versende E-Mails an Mitglieder und Trainer</p>
      </div>
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
              onValueChange={(v) => setTargetGroup(v as typeof targetGroup)}
            >
              <SelectTrigger id="target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="members">Nur Mitglieder</SelectItem>
                <SelectItem value="trainers">Nur Trainer</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
    </div>
  );
}
