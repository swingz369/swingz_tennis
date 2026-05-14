'use client';

import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { de } from 'date-fns/locale';
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
import type { Session } from '@/hooks/use-sessions';
import { useSessions } from '@/hooks/use-sessions';
import type { Invoice } from '@/lib/invoice-pdf';
import { downloadInvoicePDF, generateInvoiceFromBookings } from '@/lib/invoice-pdf';

export default function MemberBilling() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const { data: clubData } = useUserClub();
  const { data: memberData } = useUserMember();

  const clubId = clubData?.clubId ?? null;

  const { data: sessions = [], isLoading } = useSessions(clubId);

  const memberSessions = sessions.filter((s: Session) => s.bookedByUser);

  const getMonthSessions = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    return memberSessions.filter((session: Session): session is Session & { week: string } => {
      return (
        !!session.week &&
        isWithinInterval(new Date(session.week), { start: monthStart, end: monthEnd })
      );
    });
  };

  const monthSessions = getMonthSessions();

  const generateMonthlyInvoice = () => {
    if (monthSessions.length === 0) {
      toast.error('Keine Sessions für diesen Monat gefunden');
      return;
    }

    const invoice = generateInvoiceFromBookings(monthSessions, memberData);
    setInvoices((prev) => [...prev, invoice]);
    toast.success('Rechnung generiert');
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    try {
      downloadInvoicePDF(invoice);
      toast.success('PDF-Download gestartet');
    } catch (error) {
      toast.error('PDF-Download fehlgeschlagen');
      console.error('PDF download error:', error);
    }
  };

  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  const getInvoiceStatus = (invoice: Invoice) => {
    const now = new Date();
    if (invoice.status === 'paid') {
      return { label: 'Bezahlt', color: 'bg-green-100 text-green-700' };
    }
    if (invoice.dueDate < now) {
      return { label: 'Überfällig', color: 'bg-red-100 text-red-700' };
    }
    return { label: 'Ausstehend', color: 'bg-yellow-100 text-yellow-700' };
  };

  const calculateMonthlyTotal = () => {
    const rate = clubData?.club?.defaultHourlyRate || 15.0;
    return monthSessions.length * rate;
  };

  const monthlyTotal = calculateMonthlyTotal();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Rechnungen & Zahlungen</h1>
          <p className="text-gray-500">Verwalte deine Rechnungen und Zahlungen</p>
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
            <CardTitle className="text-sm font-medium text-gray-600">Diesen Monat</CardTitle>
            <Calendar className="h-4 w-4 text-brand-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{monthlyTotal.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">{monthSessions.length} Sessions gebucht</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ausstehend</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €
              {invoices
                .filter((inv) => inv.status === 'pending')
                .reduce((sum, inv) => sum + inv.total, 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {invoices.filter((inv) => inv.status === 'pending').length} Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Bezahlt</CardTitle>
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
            <p className="text-xs text-gray-500 mt-1">
              {invoices.filter((inv) => inv.status === 'paid').length} Rechnungen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Current Month Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Monatsübersicht {format(currentMonth, 'MMMM yyyy', { locale: de })}</CardTitle>
        </CardHeader>
        <CardContent>
          {monthSessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Keine Trainings für diesen Monat gebucht
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold">Trainingssessions</div>
                  <div className="text-sm text-gray-600">
                    {monthSessions.length} Sessions × €15.00 = €{monthlyTotal.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">€{monthlyTotal.toFixed(2)}</div>
                  <div className="text-sm text-gray-600">zzgl. 19% MwSt</div>
                </div>
              </div>

              <Button
                onClick={generateMonthlyInvoice}
                className="w-full"
                disabled={monthSessions.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Rechnung generieren
              </Button>
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
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
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
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-primary/10 rounded-lg">
                        <FileText className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{invoice.invoiceNumber}</div>
                        <div className="text-sm text-gray-600">
                          {format(invoice.issueDate, 'dd. MMMM yyyy', { locale: de })}
                        </div>
                        <div className="text-sm text-gray-600">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
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
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <strong>Zahlungsweise:</strong> SEPA-Lastschrift
            </p>
            <p>
              <strong>Zahlungsfrist:</strong> 14 Tage nach Rechnungsdatum
            </p>
            <p>
              <strong>MwSt:</strong> 19% (gemäß § 19 UStG)
            </p>
            <p className="mt-4 text-gray-600">
              Bei Fragen zu deinen Rechnungen kontaktiere bitte unsere Buchhaltung unter{' '}
              <a href="mailto:billing@swingz.app" className="text-brand-primary hover:underline">
                billing@swingz.app
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
