'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';

import { createLogger } from '@/lib/logger';

const log = createLogger('admin:members:[id]:invoices-tab');

interface InvoiceData {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  invoice_type: string;
  created_at: string;
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: 'Entwurf', className: 'bg-muted text-muted-foreground' },
    open: {
      label: 'Offen',
      className: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
    },
    sent: {
      label: 'Versendet',
      className: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
    },
    paid: {
      label: 'Bezahlt',
      className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    },
    overdue: {
      label: 'Überfällig',
      className: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    },
    cancelled: { label: 'Storniert', className: 'bg-muted text-muted-foreground line-through' },
  };
  const c = config[status] ?? config.draft;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>{c.label}</span>
  );
}

function InvoiceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    season: {
      label: 'Saison',
      className: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
    },
    membership: {
      label: 'Mitgliedsbeitrag',
      className: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-300',
    },
    adhoc: { label: 'Zusatz', className: 'bg-muted text-muted-foreground' },
  };
  const c = config[type] ?? config.adhoc;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>{c.label}</span>
  );
}

interface Props {
  userId: string;
}

export function InvoicesTab({ userId }: Props) {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(
        `/api/billing/invoices/overview?memberId=${encodeURIComponent(userId)}`
      );
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.invoices || []);
      } else {
        toast.error('Rechnungen konnten nicht geladen werden');
      }
    } catch (err) {
      log.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Lade Rechnungen...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
        <p>Noch keine Rechnungen vorhanden</p>
      </div>
    );
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const openCount = invoices.filter((inv) =>
    ['draft', 'open', 'sent', 'overdue'].includes(inv.status)
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <strong>{invoices.length}</strong> Rechnungen
        </span>
        <span>
          <strong>{openCount}</strong> offen
        </span>
        <span>
          Gesamt: <strong>{totalAmount.toFixed(2)} €</strong>
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rechnungsnr.</TableHead>
            <TableHead>Typ</TableHead>
            <TableHead>Betrag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fällig</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-mono text-sm">
                {invoice.invoice_number || invoice.id.slice(0, 8)}
              </TableCell>
              <TableCell>
                <InvoiceTypeBadge type={invoice.invoice_type} />
              </TableCell>
              <TableCell>
                {(invoice.amount || 0).toFixed(2)} {invoice.currency || 'EUR'}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell>
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-DE') : '-'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                  title="PDF herunterladen"
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
