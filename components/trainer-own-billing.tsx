'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { createLogger } from '@/lib/logger';

const log = createLogger('trainer-own-billing');

/** Übungsleiterpauschale § 3 Nr. 26 EStG — Jahresfreibetrag. */
const ANNUAL_TAX_FREE_LIMIT = 3000;

interface OwnBilling {
  id: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  tax_free_amount: number;
  taxable_amount: number;
  status: 'pending' | 'processed' | 'paid' | 'overdue';
  due_date: string | null;
  paid_at: string | null;
}

const STATUS_LABELS: Record<OwnBilling['status'], string> = {
  pending: 'Ausstehend',
  processed: 'Verarbeitet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
};

export function TrainerOwnBilling() {
  const [billings, setBillings] = useState<OwnBilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/trainer/billing', { credentials: 'include' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(extractErrorMessage(data) ?? 'Abrechnung konnte nicht geladen werden.');
          return;
        }
        setBillings(data.trainerBillings ?? []);
      } catch (err) {
        if (cancelled) return;
        log.error('Laden fehlgeschlagen', err instanceof Error ? err : undefined);
        setError('Abrechnung konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentYear = new Date().getFullYear();
  const thisYear = billings.filter((b) => {
    const date = b.due_date ?? b.paid_at;
    // ponytail: ohne Datum keine Jahreszuordnung — Zeile zählt nicht mit
    return date ? new Date(date).getFullYear() === currentYear : false;
  });
  const taxFreeUsed = thisYear.reduce((sum, b) => sum + Number(b.tax_free_amount ?? 0), 0);
  const taxFreeLeft = Math.max(0, ANNUAL_TAX_FREE_LIMIT - taxFreeUsed);
  const openAmount = billings
    .filter((b) => b.status !== 'paid')
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Abrechnung"
        description="Deine Honorare aus den freigegebenen Stundennachweisen"
      />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
          Abrechnung wird geladen …
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Noch offen</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(openAmount)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Übungsleiterpauschale {currentYear} — noch frei</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(taxFreeLeft)}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {formatCurrency(taxFreeUsed)} von {formatCurrency(ANNUAL_TAX_FREE_LIMIT)} genutzt (§
                3 Nr. 26 EStG)
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Abrechnungen</CardTitle>
              <CardDescription>
                Erstellt der Verein aus deinen freigegebenen Stundennachweisen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Noch keine Abrechnung vorhanden. Sobald der Verein deine Stundennachweise
                  freigibt, erscheint sie hier.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Stunden</TableHead>
                        <TableHead className="text-right">Satz</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                        <TableHead className="text-right">davon steuerfrei</TableHead>
                        <TableHead>Fällig</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {billings.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-right">
                            {formatNumber(b.total_hours)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(b.hourly_rate)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(b.total_amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(b.tax_free_amount)}
                          </TableCell>
                          <TableCell>{b.due_date ? formatDate(b.due_date) : '—'}</TableCell>
                          <TableCell>
                            <StatusBadge
                              status={b.status}
                              label={STATUS_LABELS[b.status]}
                              size="sm"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
