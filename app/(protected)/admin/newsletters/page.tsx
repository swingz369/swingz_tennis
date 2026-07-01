'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';
import { Mail, Send, Clock, ChevronRight, ChevronLeft } from 'lucide-react';

type Template = 'news' | 'event' | 'reminder';

const TEMPLATES: Record<Template, { label: string; subject: string; body: string }> = {
  news: {
    label: 'Neuigkeiten',
    subject: 'Neuigkeiten aus dem Verein',
    body: '<p>Liebe Vereinsmitglieder,</p><p>wir möchten euch über folgende Neuigkeiten informieren:</p><p><strong>[Inhalt hier einfügen]</strong></p><p>Mit sportlichen Grüßen,<br/>Euer Vorstand</p>',
  },
  event: {
    label: 'Veranstaltung',
    subject: 'Einladung: [Veranstaltungsname]',
    body: '<p>Liebe Vereinsmitglieder,</p><p>wir laden euch herzlich zu folgender Veranstaltung ein:</p><p><strong>Datum:</strong> [Datum]<br/><strong>Uhrzeit:</strong> [Uhrzeit]<br/><strong>Ort:</strong> [Ort]</p><p>Wir freuen uns auf euch!<br/>Euer Vorstand</p>',
  },
  reminder: {
    label: 'Erinnerung',
    subject: 'Erinnerung: [Thema]',
    body: '<p>Liebe Vereinsmitglieder,</p><p>wir möchten euch an folgendes erinnern:</p><p><strong>[Inhalt hier einfügen]</strong></p><p>Bei Fragen stehen wir gerne zur Verfügung.<br/>Euer Vorstand</p>',
  },
};

interface Campaign {
  id: string;
  template: string;
  subject: string;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
}

export default function NewsletterPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [template, setTemplate] = useState<Template>('news');
  const [subject, setSubject] = useState(TEMPLATES.news.subject);
  const [bodyHtml, setBodyHtml] = useState(TEMPLATES.news.body);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/newsletters')
      .then((r) => r.json())
      .then((d: { campaigns?: Campaign[] }) => setCampaigns(d.campaigns ?? []))
      .catch(() => {});
  }, [result]);

  function selectTemplate(t: Template) {
    setTemplate(t);
    setSubject(TEMPLATES[t].subject);
    setBodyHtml(TEMPLATES[t].body);
  }

  async function send() {
    setSending(true);
    try {
      const r = await apiFetch('/api/admin/newsletters', {
        method: 'POST',
        body: JSON.stringify({ template, subject, body_html: bodyHtml }),
      });
      const data = (await r.json()) as { sent?: number; failed?: number; error?: string };
      if (!r.ok) {
        toast.error(data.error ?? 'Fehler beim Versenden');
        return;
      }
      setResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 });
      setStep(3);
      toast.success(`Newsletter versendet: ${data.sent ?? 0} erfolgreich`);
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep(1);
    setResult(null);
    selectTemplate('news');
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> Newsletter
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Nachrichten an alle aktiven Vereinsmitglieder senden
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {(['1. Vorlage', '2. Inhalt', '3. Ergebnis'] as const).map((label, i) => (
          <span
            key={label}
            className={`px-2 py-0.5 rounded ${step === i + 1 ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'}`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Step 1 — Vorlage */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vorlage wählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.entries(TEMPLATES) as [Template, (typeof TEMPLATES)[Template]][]).map(
              ([key, tpl]) => (
                <button
                  key={key}
                  onClick={() => selectTemplate(key)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${template === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                >
                  <p className="font-medium text-sm">{tpl.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.subject}</p>
                </button>
              )
            )}
            <Button className="w-full mt-2" onClick={() => setStep(2)}>
              Weiter <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Inhalt */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inhalt bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="nl-subject" className="text-sm font-medium">
                Betreff
              </label>
              <Input
                id="nl-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Betreff der E-Mail"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="nl-body" className="text-sm font-medium">
                Inhalt (HTML)
              </label>
              <Textarea
                id="nl-body"
                rows={10}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Vorschau</p>
              <div
                className="border rounded-md p-4 text-sm prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Zurück
              </Button>
              <Button
                className="flex-1"
                disabled={sending || !subject.trim() || !bodyHtml.trim()}
                onClick={() => void send()}
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Wird gesendet…' : 'Jetzt versenden'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Ergebnis */}
      {step === 3 && result && (
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <Send className="h-10 w-10 mx-auto text-success-600" />
            <div>
              <p className="text-lg font-semibold">Newsletter versendet</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.sent} erfolgreich · {result.failed} fehlgeschlagen
              </p>
            </div>
            <Button onClick={reset}>Neuen Newsletter erstellen</Button>
          </CardContent>
        </Card>
      )}

      {/* Verlauf */}
      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{c.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {TEMPLATES[c.template as Template]?.label ?? c.template} · {c.recipient_count}{' '}
                      Empfänger
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.sent_at ? (
                      <Badge variant="success" className="gap-1 text-xs">
                        <Send className="h-3 w-3" />
                        {new Date(c.sent_at).toLocaleDateString('de-DE')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Clock className="h-3 w-3" /> Ausstehend
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
