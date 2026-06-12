'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { de } from '@/lib/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Calendar,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import { useFamilyAccounts } from '@/hooks/use-family-accounts';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';
import type { Invoice } from '@/lib/invoice-pdf';
import { apiFetch } from '@/lib/api-fetch';

export default function MemberBilling() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  const searchParams = useSearchParams();
  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();
  const family = useFamilyAccounts();
  const isMinorAccount = family.effectiveIsMinor;

  const clubId = clubData?.clubId ?? null;
  const memberId = memberData?.memberId ?? null;

  // Show payment success/cancel notification on return from Stripe
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Zahlung erfolgreich! Deine Rechnung wurde bezahlt.');
      // Clean URL — remove ?payment=success without page reload
      window.history.replaceState({}, '', '/billing');
    } else if (paymentStatus === 'cancelled') {
      toast.info('Zahlung abgebrochen. Du kannst jederzeit erneut bezahlen.');
      window.history.replaceState({}, '', '/billing');
    }
  }, [searchParams]);

  const { data: sessions = [], isLoading } = useSessions(clubId);

  // Fetch persisted invoices from the API on mount and whenever memberId changes
  useEffect(() => {
    if (!memberId) return;
    setInvoicesLoading(true);
    apiFetch(`/api/billing/invoices/overview?memberId=${encodeURIComponent(memberId)}`, {
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load invoices');
        return res.json();
      })
      .then((json) => {
        // The overview endpoint returns { invoices: [...], summary, pagination }
        // Each invoice from billingEngine has snake_case fields; map to the local Invoice shape.
        const fetched: Invoice[] = (json.invoices ?? []).map((inv: Record<string, unknown>) => {
          const subtotal = Number(inv.amount ?? inv.subtotal ?? 0);
          return {
            id: inv.id as string,
            invoiceNumber: (inv.invoice_number ?? inv.invoiceNumber ?? '') as string,
            issueDate: new Date((inv.created_at ?? inv.issueDate) as string),
            dueDate: new Date((inv.due_date ?? inv.dueDate) as string),
            customerName: (inv.customer_name ?? inv.customerName ?? '') as string,
            customerEmail: (inv.customer_email ?? inv.customerEmail ?? '') as string,
            items: (inv.items as Invoice['items']) ?? [],
            subtotal,
            taxRate: 19,
            taxAmount: subtotal * 0.19,
            total: Number(inv.amount ?? inv.total ?? subtotal),
            status: (inv.status as Invoice['status']) ?? 'pending',
          };
        });
        setInvoices(fetched);
      })
      .catch((err) => {
        console.error('Error loading invoices:', err);
        toast.error('Rechnungen konnten nicht geladen werden');
      })
      .finally(() => setInvoicesLoading(false));
  }, [memberId]);

  const memberSessions = sessions.filter((s: Session) => s.bookedByUser);

  const getMonthSessions = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return memberSessions.filter((session: Session) => {
      if (!session.timeslotStart) return false;
      return isWithinInterval(new Date(session.timeslotStart), {
        start: monthStart,
        end: monthEnd,
      });
    });
  };

  const monthSessions = getMonthSessions();

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const res = await apiFetch(`/api/invoices/${invoice.id}/pdf`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'PDF-Generierung fehlgeschlagen' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF-Download gestartet');
    } catch (error) {
      toast.error('PDF-Download fehlgeschlagen');
      console.error('PDF download error:', error);
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // ── Pay invoice via Stripe Checkout ──
  const handlePayInvoice = async (invoice: Invoice) => {
    try {
      const res = await apiFetch(`/api/billing/invoices/${invoice.id}/checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? 'Zahlung konnte nicht gestartet werden'
        );
      }
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        window.open(checkoutUrl, '_self');
      } else {
        throw new Error('Keine Checkout-URL erhalten');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zahlung fehlgeschlagen');
    }
  };

  const getInvoiceStatus = (invoice: Invoice) => {
    const now = new Date();
    const status = invoice.status;
    if (status === 'paid') {
      return {
        label: 'Bezahlt',
        color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
        isPaid: true,
      };
    }
    if (status === 'cancelled' || status === 'refunded') {
      return {
        label: status === 'cancelled' ? 'Storniert' : 'Erstattet',
        color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
        isPaid: true,
      };
    }
    if (invoice.dueDate && invoice.dueDate < now) {
      return {
        label: 'Überfällig',
        color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        isPaid: false,
      };
    }
    return {
      label: 'Ausstehend',
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
      isPaid: false,
    };
  };

  // Only pay invoices that are open/sent/partially_paid/overdue
  const canPayInvoice = (invoice: Invoice) => {
    return ['open', 'sent', 'partially_paid', 'overdue'].includes(invoice.status ?? '');
  };

  const hourlyRate = clubData?.club?.defaultHourlyRate ?? 15.0;
  const calculateMonthlyTotal = () => {
    return monthSessions.length * hourlyRate;
  };

  const monthlyTotal = calculateMonthlyTotal();

  // Show loading only while actively fetching, not when queries are disabled (clubId/memberId null)
  const isActivelyLoading = (isLoading && !!clubId) || (invoicesLoading && !!memberId);

  if (isActivelyLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Laden...</div>
      </div>
    );
  }

  // Minor accounts cannot access billing — show a message instead
  if (isMinorAccount) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Zugang eingeschränkt</h2>
          <p className="text-muted-foreground max-w-md">
            Rechnungen und Zahlungen werden von deinen Eltern verwaltet. Bitte wende dich an deine
            Eltern oder Erziehungsberechtigten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Rechnungen & Zahlungen</h1>
          <p className="text-muted-foreground">Verwalte deine Rechnungen und Zahlungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[150px] text-center font-medium text-sm md:text-base">
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Diesen Monat
            </CardTitle>
            <Calendar className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{monthlyTotal.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthSessions.length} Sessions gebucht
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ausstehend</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €
              {invoices
                .filter((inv) => !getInvoiceStatus(inv).isPaid)
                .reduce((sum, inv) => sum + inv.total, 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.filter((inv) => !getInvoiceStatus(inv).isPaid).length} Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bezahlt</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €
              {invoices
                .filter((inv) => inv.status === 'paid')
                .reduce((sum, inv) => sum + inv.total, 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.filter((inv) => inv.status === 'paid').length} Rechnungen
            </p>
          </CardContent>
        </Card>
      </div>{' '}
      {/* Current Month Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monatsübersicht {format(currentMonth, 'MMMM yyyy', { locale: de })}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Keine Trainings für diesen Monat gebucht
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <div className="font-semibold">Trainingssessions</div>
                <div className="text-sm text-muted-foreground">
                  {monthSessions.length} Sessions × €{hourlyRate.toFixed(2)} = €
                  {monthlyTotal.toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">€{monthlyTotal.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">
                  zzgl. {clubData?.club?.taxRate ?? 0}% MwSt
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Rechnungen</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Noch keine Rechnungen vorhanden</p>
              <p className="text-sm mt-2">Buche Trainingssessions, um Rechnungen zu generieren</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => {
                const status = getInvoiceStatus(invoice);
                return (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{invoice.invoiceNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(invoice.issueDate, 'dd. MMMM yyyy', { locale: de })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Fällig: {format(invoice.dueDate, 'dd. MMMM yyyy', { locale: de })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">€{invoice.total.toFixed(2)}</div>
                        <div className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!status.isPaid && canPayInvoice(invoice) && (
                          <Button
                            size="sm"
                            onClick={() => handlePayInvoice(invoice)}
                            className="gap-1.5"
                          >
                            <CreditCard className="h-4 w-4" />
                            Bezahlen
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Payment Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Zahlungsinformationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-foreground">
            <p>
              <strong>Zahlungsweise:</strong> SEPA-Lastschrift
            </p>
            <p>
              <strong>Zahlungsfrist:</strong> 14 Tage nach Rechnungsdatum
            </p>
            <p>
              <strong>MwSt:</strong> 19% (gemäß § 19 UStG)
            </p>
            <p className="mt-4 text-muted-foreground">
              Bei Fragen zu deinen Rechnungen kontaktiere bitte unsere Buchhaltung unter{' '}
              <a href="mailto:billing@swingz.cloud" className="text-brand-primary hover:underline">
                billing@swingz.cloud
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
