'use client';

import { useState, useEffect } from 'react';
import { format, parseISO, addMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  Calendar,
  Clock,
  User,
  CheckCircle,
  Download,
  FileText,
  Printer,
  Mail,
  Filter,
  ChevronLeft,
  ChevronRight,
  Receipt,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface TrainerBilling {
  id: string;
  billingPeriodId: string;
  trainerId: string;
  trainerName: string;
  totalHours: number;
  hourlyRate: number;
  totalAmount: number;
  status: 'pending' | 'processed' | 'paid' | 'overdue';
  invoiceId?: string;
  invoiceNumber?: string;
  dueDate?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  billingPeriodId: string;
  totalTrainers: number;
  totalHours: number;
  totalAmount: number;
  pendingAmount: number;
  processedAmount: number;
  paidAmount: number;
  overdueAmount: number;
}

export default function MonthlyBillingOverview() {
  const [trainerBillings, setTrainerBillings] = useState<TrainerBilling[]>([]);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'pending' | 'processed' | 'paid' | 'overdue'
  >('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBillingData();
  }, [selectedPeriod]);

  const loadBillingData = async () => {
    try {
      setIsLoading(true);

      // In production, this would fetch from an API
      // For now, we'll use mock data
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockSummary: BillingSummary = {
        billingPeriodId: 'current',
        totalTrainers: 2,
        totalHours: 60,
        totalAmount: 3140,
        pendingAmount: 3140,
        processedAmount: 0,
        paidAmount: 0,
        overdueAmount: 0,
      };

      setBillingSummary(mockSummary);
      setTrainerBillings([
        {
          id: 'billing-1',
          billingPeriodId: 'current',
          trainerId: 'trainer-1',
          trainerName: 'Thomas Müller',
          totalHours: 32,
          hourlyRate: 50,
          totalAmount: 1600,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'billing-2',
          billingPeriodId: 'current',
          trainerId: 'trainer-2',
          trainerName: 'Julia Weber',
          totalHours: 28,
          hourlyRate: 55,
          totalAmount: 1540,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Fehler beim Laden der Abrechnungsdaten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (_id: string) => {
    try {
      const response = await fetch(`/api/billing/trainers/${_id}/pay`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as paid');
      }

      const data = await response.json();
      setTrainerBillings(trainerBillings.map((b) => (b.id === _id ? data.trainerBilling : b)));
      toast.success('Abrechnung als bezahlt markiert');
    } catch (error) {
      toast.error('Fehler beim Markieren als bezahlt');
      console.error('Mark as paid error:', error);
    }
  };

  const handleMarkAsOverdue = async (_id: string) => {
    try {
      const response = await fetch(`/api/billing/trainers/${_id}/overdue`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as overdue');
      }

      const data = await response.json();
      setTrainerBillings(trainerBillings.map((b) => (b.id === _id ? data.trainerBilling : b)));
      toast.success('Abrechnung als überfällig markiert');
    } catch (error) {
      toast.error('Fehler beim Markieren als überfällig');
      console.error('Mark as overdue error:', error);
    }
  };

  const handleGenerateInvoice = async (_id: string) => {
    try {
      // In production, this would generate a PDF invoice
      toast.success('Rechnung wird generiert...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('Rechnung erfolgreich generiert');
    } catch (error) {
      toast.error('Fehler bei der Rechnungsgenerierung');
      console.error('Generate invoice error:', error);
    }
  };

  const handleSendInvoice = async (_id: string) => {
    try {
      // In production, this would send the invoice via email
      toast.success('Rechnung wird gesendet...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      toast.success('Rechnung erfolgreich gesendet');
    } catch (error) {
      toast.error('Fehler beim Senden der Rechnung');
      console.error('Send invoice error:', error);
    }
  };

  const getStatusColor = (status: TrainerBilling['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'processed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
    }
  };

  const getStatusLabel = (status: TrainerBilling['status']) => {
    switch (status) {
      case 'pending':
        return 'Ausstehend';
      case 'processed':
        return 'Verarbeitet';
      case 'paid':
        return 'Bezahlt';
      case 'overdue':
        return 'Überfällig';
    }
  };

  const filteredBillings = trainerBillings.filter(
    (b) => selectedStatus === 'all' || b.status === selectedStatus
  );

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Monatsabrechnung</h1>
          <p className="text-gray-500">Übersicht und Verwaltung der monatlichen Abrechnungen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Drucken
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedPeriod(addMonths(selectedPeriod, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium">
          {format(selectedPeriod, 'MMMM yyyy', { locale: de })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedPeriod(addMonths(selectedPeriod, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSelectedPeriod(new Date())}>
          Heute
        </Button>
      </div>

      {/* Summary Stats */}
      {billingSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Gesamt</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">€{billingSummary.totalAmount.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">
                {billingSummary.totalTrainers} Trainer • {billingSummary.totalHours}h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ausstehend</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                €{billingSummary.pendingAmount.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Noch nicht bezahlt</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Bezahlt</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                €{billingSummary.paidAmount.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Erfolgreich bezahlt</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Überfällig</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                €{billingSummary.overdueAmount.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Zahlung überfällig</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Status</option>
            <option value="pending">Ausstehend</option>
            <option value="processed">Verarbeitet</option>
            <option value="paid">Bezahlt</option>
            <option value="overdue">Überfällig</option>
          </select>
        </div>
      </div>

      {/* Trainer Billings */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Trainer-Abrechnungen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBillings.map((billing) => (
            <Card key={billing.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        <User className="h-5 w-5 text-brand-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{billing.trainerName}</div>
                        <div className="text-sm text-gray-600">ID: {billing.trainerId}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(billing.status)}>
                      {getStatusLabel(billing.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Gesamtstunden:</span>
                      <div className="font-medium">{billing.totalHours}h</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Stundensatz:</span>
                      <div className="font-medium">€{billing.hourlyRate}/h</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Gesamtbetrag:</span>
                      <span className="text-2xl font-bold text-brand-primary">
                        €{billing.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {billing.invoiceNumber && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Receipt className="h-4 w-4" />
                      <span>Rechnung: {billing.invoiceNumber}</span>
                    </div>
                  )}

                  {billing.dueDate && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Fällig am:{' '}
                        {format(parseISO(billing.dueDate), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                  )}

                  {billing.paidAt && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        Bezahlt am:{' '}
                        {format(parseISO(billing.paidAt), 'dd. MMM yyyy', { locale: de })}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    {billing.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(billing.id)}
                          className="flex-1"
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Als bezahlt
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsOverdue(billing.id)}
                          className="flex-1"
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Überfällig
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateInvoice(billing.id)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Rechnung
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendInvoice(billing.id)}
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Senden
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
