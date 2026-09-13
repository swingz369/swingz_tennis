'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';

interface TrainerBilling {
  id: string;
  trainer_name: string;
  total_hours: number;
  hourly_rate: number;
  total_amount: number;
  tax_free_amount: number;
  taxable_amount: number;
  status: 'pending' | 'processed' | 'paid' | 'overdue';
  due_date: string | null;
  paid_at: string | null;
}

interface TrainerRate {
  id: string;
  trainerName: string;
  baseRate: number;
  overrideRate?: number;
  effectiveRate: number;
  validFrom: string;
}

const STATUS_LABELS: Record<TrainerBilling['status'], string> = {
  pending: 'Ausstehend',
  processed: 'Verarbeitet',
  paid: 'Bezahlt',
  overdue: 'Überfällig',
};

export function TrainerBillingTab() {
  const [billings, setBillings] = useState<TrainerBilling[]>([]);
  const [rates, setRates] = useState<TrainerRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, rRes] = await Promise.all([
        apiFetch('/api/billing/trainers', { credentials: 'include' }),
        apiFetch('/api/hourly-rates/trainers', { credentials: 'include' }),
      ]);
      if (bRes.ok) {
        const data = await bRes.json();
        setBillings(data.trainerBillings ?? []);
      }
      if (rRes.ok) {
        const data = await rRes.json();
        setRates(data.trainerRates ?? []);
      }
      if (!bRes.ok && !rRes.ok) {
        toast.error('Trainer-Abrechnungen konnten nicht geladen werden');
      }
    } catch {
      toast.error('Trainer-Abrechnungen konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, action: 'pay' | 'overdue') => {
    setActing(`${id}:${action}`);
    try {
      const res = await apiFetch(`/api/billing/trainers/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err) || 'Aktion fehlgeschlagen');
      }
      const data = await res.json().catch(() => ({}));
      setBillings((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                ...(data.trainerBilling ?? { status: action === 'pay' ? 'paid' : 'overdue' }),
              }
            : b
        )
      );
      toast.success(action === 'pay' ? 'Als bezahlt markiert' : 'Als überfällig markiert');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" aria-hidden="true" />
        Trainer-Abrechnungen werden geladen …
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trainer-Abrechnungen</CardTitle>
          <CardDescription>
            Vergütungen der Trainer inkl. Übungsleiterpauschale (§ 3 Nr. 26 EStG, max. 3.000 €
            steuerfrei pro Jahr)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {billings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Noch keine Trainer-Abrechnungen vorhanden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainer</TableHead>
                    <TableHead className="text-right">Stunden</TableHead>
                    <TableHead className="text-right">Satz</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead className="text-right">davon steuerfrei</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.trainer_name}</TableCell>
                      <TableCell className="text-right">{formatNumber(b.total_hours)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.hourly_rate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(b.total_amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(b.tax_free_amount)}
                      </TableCell>
                      <TableCell>{b.due_date ? formatDate(b.due_date) : '—'}</TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} label={STATUS_LABELS[b.status]} size="sm" />
                      </TableCell>
                      <TableCell className="text-right">
                        {b.status !== 'paid' && (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === `${b.id}:pay`}
                              onClick={() => handleAction(b.id, 'pay')}
                              className="gap-1"
                            >
                              {acting === `${b.id}:pay` ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                              )}
                              Als bezahlt markieren
                            </Button>
                            {b.status !== 'overdue' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={acting === `${b.id}:overdue`}
                                onClick={() => handleAction(b.id, 'overdue')}
                                className="gap-1 text-muted-foreground"
                              >
                                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                Überfällig
                              </Button>
                            )}
                          </div>
                        )}
                        {b.status === 'paid' && b.paid_at && (
                          <span className="text-sm text-muted-foreground">
                            bezahlt am {formatDate(b.paid_at)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stundensätze</CardTitle>
          <CardDescription>Aktuell hinterlegte Vergütungssätze pro Trainer</CardDescription>
        </CardHeader>
        <CardContent>
          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Noch keine Stundensätze hinterlegt.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainer</TableHead>
                    <TableHead className="text-right">Basissatz</TableHead>
                    <TableHead className="text-right">Effektiver Satz</TableHead>
                    <TableHead>Gültig ab</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.trainerName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.baseRate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(r.effectiveRate)}
                        {r.overrideRate != null && (
                          <span className="ml-1 text-xs text-muted-foreground">(individuell)</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(r.validFrom)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
