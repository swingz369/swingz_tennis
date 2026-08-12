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
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUserClub, useUserMember } from '@/hooks/use-user-data';
import { useFamilyAccounts } from '@/hooks/use-family-accounts';
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';
import type { Invoice, InvoiceItem } from '@/lib/invoice-pdf';
import { apiFetch } from '@/lib/api-fetch';
import { StatCard } from '@/components/ui/stat-card';

import { createLogger } from '@/lib/logger';

const log = createLogger('member-billing');

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
            invoiceType: (inv.invoice_type ?? null) as string | null,
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
        log.error('Error loading invoices:', err);
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
      log.error('PDF download error:', error);
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
        color: 'bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-400',
        isPaid: true,
      };
    }
    if (status === 'cancelled' || status === 'refunded') {
      return {
        label: status === 'cancelled' ? 'Storniert' : 'Erstattet',
        color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        isPaid: true,
      };
    }
    if (invoice.dueDate && invoice.dueDate < now) {
      return {
        label: 'Überfällig',
        color: 'bg-error-100 text-error-700 dark:bg-error-900/20 dark:text-error-400',
        isPaid: false,
      };
    }
    return {
      label: 'Ausstehend',
      color: 'bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
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
          <div className="h-16 w-16 rounded-xl bg-warning-100 dark:bg-warning-900/20 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-warning-600 dark:text-warning-400" />
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

  const openAmount = invoices
    .filter((inv) => !getInvoiceStatus(inv).isPaid)
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const openCount = invoices.filter((inv) => !getInvoiceStatus(inv).isPaid).length;
  const paidCount = invoices.filter((inv) => inv.status === 'paid').length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Rechnungen & Zahlungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verwalte deine Rechnungen und Zahlungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[130px] text-center font-medium text-sm">
            {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Calendar}
          label="Diesen Monat"
          value={`€${monthlyTotal.toFixed(2)}`}
          sub={`${monthSessions.length} Sessions`}
          color="blue"
        />
        <StatCard
          icon={CreditCard}
          label="Ausstehend"
          value={`€${openAmount.toFixed(2)}`}
          sub={`${openCount} Rechnungen`}
          color="orange"
        />
        <StatCard
          icon={CheckCircle2}
          label="Bezahlt"
          value={`€${paidAmount.toFixed(2)}`}
          sub={`${paidCount} Rechnungen`}
          color="green"
        />
        <StatCard
          icon={Receipt}
          label="Gesamt"
          value={invoices.length}
          sub="Rechnungen"
          color="brand"
          animate
        />
      </div>
      {/* Current Month Summary — Enhanced Kosten-Monatsübersicht (QW3) */}
      <Card>
        <CardHeader>
          <CardTitle>
            Kosten-Monatsübersicht {format(currentMonth, 'MMMM yyyy', { locale: de })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const taxRate = clubData?.club?.taxRate ?? 0;
            // Categorize invoices for this month
            const monthInvoices = invoices.filter((inv) => {
              const d = inv.issueDate;
              return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth);
            });
            // API returns items with item_type/itemType — access via bracket notation since InvoiceItem type doesn't include it
            const isMembershipFee = (it: InvoiceItem) =>
              (it as unknown as { itemType?: string; item_type?: string }).itemType ===
                'membership_fee' ||
              (it as unknown as { itemType?: string; item_type?: string }).item_type ===
                'membership_fee';
            // Rechnungen werden nach `invoice_type` einsortiert (membership |
            // season | adhoc). Vorher entschied allein, ob eine Position vom Typ
            // `membership_fee` dabei war — eine Saison-Trainingsrechnung landete
            // dadurch unter „Sonstiges: Shop, Platzgebühren, etc.".
            const isMembershipInvoice = (inv: (typeof monthInvoices)[number]) =>
              inv.invoiceType === 'membership' || !!inv.items?.some(isMembershipFee);
            const isSeasonInvoice = (inv: (typeof monthInvoices)[number]) =>
              inv.invoiceType === 'season' && !isMembershipInvoice(inv);

            const membershipCosts = monthInvoices
              .filter(isMembershipInvoice)
              .reduce((sum, inv) => sum + inv.subtotal, 0);
            const seasonCosts = monthInvoices
              .filter(isSeasonInvoice)
              .reduce((sum, inv) => sum + inv.subtotal, 0);
            const trainingCosts = monthSessions.length * hourlyRate;
            const otherCosts = monthInvoices
              .filter((inv) => !isMembershipInvoice(inv) && !isSeasonInvoice(inv))
              .reduce((sum, inv) => sum + inv.subtotal, 0);
            const totalBeforeTax = membershipCosts + seasonCosts + trainingCosts + otherCosts;
            const taxAmount = totalBeforeTax * (taxRate / 100);
            const totalWithTax = totalBeforeTax + taxAmount;

            if (monthSessions.length === 0 && monthInvoices.length === 0) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Kosten für diesen Monat
                </div>
              );
            }

            return (
              <>
                <div className="grid gap-3">
                  {membershipCosts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-info-50 dark:bg-info-900/30 border border-info-200 dark:border-info-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-info-100 dark:bg-info-900/40">
                          <CreditCard className="h-4 w-4 text-info-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Mitgliedsbeitrag</div>
                          <div className="text-xs text-muted-foreground">Monatlicher Beitrag</div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">€{membershipCosts.toFixed(2)}</div>
                    </div>
                  )}
                  {trainingCosts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-success-50 dark:bg-success-900/30 border border-success-200 dark:border-success-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-success-100 dark:bg-success-900/40">
                          <Calendar className="h-4 w-4 text-success-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Training</div>
                          <div className="text-xs text-muted-foreground">
                            {monthSessions.length} Sessions × €{hourlyRate.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">€{trainingCosts.toFixed(2)}</div>
                    </div>
                  )}
                  {seasonCosts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/40">
                          <Calendar className="h-4 w-4 text-brand-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Saisontraining</div>
                          <div className="text-xs text-muted-foreground">
                            Trainingsgebühr der Saison
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">€{seasonCosts.toFixed(2)}</div>
                    </div>
                  )}
                  {otherCosts > 0 && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-info-50 dark:bg-info-900/30 border border-info-200 dark:border-info-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-info-100 dark:bg-info-900/40">
                          <Receipt className="h-4 w-4 text-info-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Sonstiges</div>
                          <div className="text-xs text-muted-foreground">
                            Shop, Platzgebühren, etc.
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">€{otherCosts.toFixed(2)}</div>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Zwischensumme</span>
                    <span className="font-medium">€{totalBeforeTax.toFixed(2)}</span>
                  </div>
                  {taxRate > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">MwSt ({taxRate}%)</span>
                      <span className="font-medium">€{taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Gesamt</span>
                    <span>€{totalWithTax.toFixed(2)}</span>
                  </div>
                </div>
              </>
            );
          })()}
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
                    className="flex items-center justify-between p-4 bg-muted rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-primary/10 rounded-xl">
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
      <Card className="bg-info-50 border-info-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-info-600" />
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
