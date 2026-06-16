'use client';

import { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  QrCode,
  CheckCircle2,
  Loader2,
  Camera,
  MapPin,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

/* ─────────────────── QR Code Display (Admin/Trainer) ─────────────────── */

interface QrDisplayProps {
  sessionId: string;
  courtName?: string;
  startTime?: string;
  endTime?: string;
}

export function QrCodeDisplay({ sessionId, courtName, startTime, endTime }: QrDisplayProps) {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateQr = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/qr-checkin?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('QR-Code konnte nicht generiert werden');
      const data = await res.json();
      setQrToken(data.qrToken);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <Card className="border border-border dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-5 w-5 text-brand-primary" />
          QR Check-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session info */}
        {(courtName || startTime) && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {courtName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {courtName}
              </span>
            )}
            {startTime && endTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {startTime} – {endTime}
              </span>
            )}
          </div>
        )}

        {qrToken ? (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-xl shadow-sm">
              <QRCodeSVG
                value={qrToken}
                size={200}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#1B4332"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Mitglieder scannen diesen QR-Code am Platz, um sich einzuchecken.
            </p>
            <Button variant="outline" size="sm" onClick={() => setQrToken(null)}>
              QR-Code ausblenden
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10 mb-4">
              <QrCode className="h-8 w-8 text-brand-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Generiere einen QR-Code, den Mitglieder am Platz scannen können.
            </p>
            <Button onClick={generateQr} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              QR-Code generieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────────────── QR Code Scanner (Member) ─────────────────── */

interface QrScannerManualProps {
  onSuccess?: () => void;
}

export function QrCheckinForm({ onSuccess }: QrScannerManualProps) {
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    pointsAwarded?: boolean;
  } | null>(null);

  const handleCheckin = useCallback(async () => {
    if (!sessionId.trim()) {
      toast.error('Bitte gib eine Session-ID ein');
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await apiFetch('/api/qr-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionId.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ success: false, message: data.error || 'Check-in fehlgeschlagen' });
        toast.error(data.error || 'Check-in fehlgeschlagen');
        return;
      }

      setResult({
        success: true,
        message: data.message || 'Check-in erfolgreich!',
        pointsAwarded: data.pointsAwarded,
      });
      toast.success(data.message || 'Check-in erfolgreich!');
      onSuccess?.();
    } catch {
      setResult({ success: false, message: 'Netzwerkfehler' });
      toast.error('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [sessionId, onSuccess]);

  return (
    <Card className="border border-border dark:border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-5 w-5 text-brand-primary" />
          Am Platz einchecken
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Gib die Session-ID vom QR-Code am Platz ein, um dich einzuchecken.
        </p>

        <div className="space-y-2">
          <Label htmlFor="sessionId">Session-ID</Label>
          <div className="flex gap-2">
            <Input
              id="sessionId"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Session-ID eingeben oder QR scannen"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCheckin();
              }}
            />
            <Button onClick={handleCheckin} disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Einchecken
            </Button>
          </div>
        </div>

        {/* Result feedback */}
        {result && (
          <div
            className={`rounded-lg p-4 flex items-start gap-3 ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={`text-sm font-medium ${
                  result.success
                    ? 'text-green-800 dark:text-green-300'
                    : 'text-red-800 dark:text-red-300'
                }`}
              >
                {result.message}
              </p>
              {result.pointsAwarded && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  +10 Punkte erhalten!
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
