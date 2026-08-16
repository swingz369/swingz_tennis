'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Star, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

export default function TrialFeedbackForm({
  participantId,
  clubName,
  firstName,
}: {
  participantId: string;
  clubName?: string;
  firstName?: string;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comments, setComments] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError('Bitte wähle eine Bewertung (1–5 Sterne).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/public/trial-training/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, rating, comments: comments.trim(), wouldRecommend }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractErrorMessage(data) ?? 'Feedback fehlgeschlagen');
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-lg mx-auto border-2 border-success-200 bg-success-50/50">
        <CardContent className="p-8 text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-success-500 mx-auto" />
          <h2 className="text-xl font-bold">Vielen Dank für dein Feedback!</h2>
          <p className="text-sm text-muted-foreground">
            Deine Bewertung hilft uns, das Probetraining zu verbessern.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-xl text-center">
          {firstName ? `Wie war dein Probetraining, ${firstName}?` : 'Wie war dein Probetraining?'}
        </CardTitle>
        <p className="text-sm text-muted-foreground text-center">
          {clubName ? `Dein Feedback zu ${clubName}` : 'Deine kurze Bewertung hilft uns sehr.'}
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-error-50 border border-error-200 text-error-700 text-sm mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Bewertung */}
          <div>
            <Label>Deine Bewertung</Label>
            <div className="flex items-center gap-1 mt-2" role="radiogroup" aria-label="Bewertung">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} von 5 Sternen`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHovered(n)}
                  onMouseLeave={() => setHovered(0)}
                  className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      (hovered || rating) >= n
                        ? 'text-warning-500 fill-warning-500'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Kommentar */}
          <div>
            <Label htmlFor="feedback-comments">Kommentar (optional)</Label>
            <Textarea
              id="feedback-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              placeholder="Was hat dir gefallen, was können wir besser machen?"
              className="mt-1"
            />
          </div>

          {/* Weiterempfehlung */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="would-recommend"
              checked={wouldRecommend}
              onCheckedChange={(c) => setWouldRecommend(c === true)}
              className="mt-0.5"
            />
            <Label htmlFor="would-recommend" className="text-sm font-normal cursor-pointer">
              Ich würde den Verein weiterempfehlen
            </Label>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Wird gesendet…
              </>
            ) : (
              'Feedback absenden'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
