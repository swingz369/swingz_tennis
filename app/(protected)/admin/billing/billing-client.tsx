'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CreditCard, DollarSign, Plus, Eye, FileText, Loader2, Trash2, Send } from 'lucide-react';
import CreateInvoiceDialog from '@/components/billing/create-invoice-dialog';
import PaymentImportDialog from '@/components/billing/payment-import-dialog';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { buildPageUrl } from '@/lib/pagination';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

export type Subscription = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  subtotal: number;
  amount: number;
  paidAmount: number;
  currency: string;
  status:
    | 'draft'
    | 'open'
    | 'paid'
    | 'void'
    | 'uncollectible'
    | 'sent'
    | 'reminder_sent'
    | 'partially_paid'
    | 'overdue'
    | 'dunning'
    | 'cancelled';
  invoiceType?: 'season' | 'membership' | 'adhoc';
  invoiceDate: string;
  dueDate: string;
  paidAt?: string;
  stripeInvoiceId?: string;
};

type InvoiceTypeFilter = 'all' | 'season' | 'membership' | 'adhoc';

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: 'Entwurf', className: 'bg-muted text-muted-foreground' },
    open: { label: 'Offen', className: 'bg-sky-100 text-sky-700' },
    sent: { label: 'Versendet', className: 'bg-blue-100 text-blue-700' },
    reminder_sent: { label: 'Erinnerung', className: 'bg-yellow-100 text-yellow-700' },
    partially_paid: { label: 'Teilbezahlt', className: 'bg-orange-100 text-orange-700' },
    paid: { label: 'Bezahlt', className: 'bg-green-100 text-green-700' },
    overdue: { label: 'Überfällig', className: 'bg-red-100 text-red-700' },
    dunning: { label: 'Mahnung', className: 'bg-red-200 text-red-900 font-bold' },
    cancelled: { label: 'Storniert', className: 'bg-muted text-muted-foreground line-through' },
    void: { label: 'Ungültig', className: 'bg-muted text-muted-foreground line-through' },
    uncollectible: { label: 'Uneinbringlich', className: 'bg-red-100 text-red-700 italic' },
    refunded: { label: 'Erstattet', className: 'bg-purple-100 text-purple-700' },
  };
  const c = config[status] ?? config.draft;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>{c.label}</span>
  );
}

function InvoiceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    season: { label: 'Saison', className: 'bg-purple-100 text-purple-700' },
    membership: { label: 'Mitgliedsbeitrag', className: 'bg-blue-100 text-blue-700' },
    adhoc: { label: 'Zusatz', className: 'bg-muted text-muted-foreground' },
  };
  const c = config[type] ?? config.adhoc;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>{c.label}</span>
  );
}

interface BillingClientProps {
  initialSubscriptions: Subscription[];
  initialInvoices: Invoice[];
  members: { id: string; name: string; email: string }[];
  clubId?: string | null;
  invoicePagination?: PaginationMeta;
  searchParams?: Record<string, string | string[] | undefined>;
}

// Demo members for the subscription assignment dialog
function getStatusColor(status: string) {
  switch (status) {
    case 'active':
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'canceled':
      return 'bg-muted text-foreground';
    case 'past_due':
      return 'bg-yellow-100 text-yellow-700';
    case 'unpaid':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-foreground';
  }
}

function getPlanLabel(plan: string) {
  switch (plan) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'enterprise':
      return 'Enterprise';
    default:
      return plan;
  }
}

export default function BillingClient({
  initialSubscriptions,
  initialInvoices,
  members,
  clubId,
  invoicePagination,
  searchParams,
}: BillingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('invoices');
  const subscriptions = initialSubscriptions;
  const clubMembers = members;
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Subscription['plan']>('pro');

  // Invoice type filter
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>('all');
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Adhoc invoice dialog
  const [showAdhocDialog, setShowAdhocDialog] = useState(false);
  const [adhocMemberId, setAdhocMemberId] = useState('');
  const [adhocDueDate, setAdhocDueDate] = useState('');
  const [adhocNotes, setAdhocNotes] = useState('');
  const [adhocItems, setAdhocItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);
  const [submittingAdhoc, setSubmittingAdhoc] = useState(false);

  const addItem = () =>
    setAdhocItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);

  const removeItem = (idx: number) => setAdhocItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof LineItem, value: string | number) =>
    setAdhocItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const adhocTotal = adhocItems.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2);

  useEffect(() => {
    if (!clubId || activeTab !== 'invoices') return;
    // Skip re-fetch when no type filter is active — use server-paginated initial data
    if (invoiceTypeFilter === 'all') {
      setInvoices(initialInvoices);
      return;
    }
    setLoadingInvoices(true);
    const params = new URLSearchParams({ clubId, type: invoiceTypeFilter });
    apiFetch(`/api/admin/billing/invoices?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setInvoices(
            (json.data as Record<string, unknown>[]).map((inv) => {
              return {
                id: String(inv.id),
                invoiceNumber: String(inv.invoiceNumber || ''),
                memberId: String(inv.memberId || ''),
                memberName: String(inv.memberName || 'N/A'),
                subtotal: Number(inv.subtotal ?? 0),
                amount: Number(inv.amount ?? 0),
                paidAmount: Number(inv.paidAmount ?? 0),
                currency: String(inv.currency || 'EUR'),
                status: String(inv.status || 'draft') as Invoice['status'],
                invoiceType: inv.invoiceType as Invoice['invoiceType'],
                invoiceDate: String(inv.invoiceDate || ''),
                dueDate: String(inv.dueDate || ''),
                paidAt: inv.paidAt ? String(inv.paidAt) : undefined,
              } as Invoice;
            })
          );
        }
      })
      .catch(() => toast.error('Fehler beim Laden der Rechnungen'))
      .finally(() => setLoadingInvoices(false));
  }, [clubId, activeTab, invoiceTypeFilter, initialInvoices]);

  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);

  const handleSendInvoice = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    try {
      const res = await apiFetch(`/api/billing/invoices/${invoiceId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Rechnung per E-Mail versendet');
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'sent' } : inv))
        );
      } else {
        toast.error(`Fehler: ${data.error || 'Unbekannt'}`);
      }
    } catch {
      toast.error('Netzwerkfehler beim E-Mail-Versand');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleSubmitAdhoc = async () => {
    if (!clubId || !adhocMemberId || !adhocDueDate || adhocItems.length === 0) {
      toast.error('Bitte alle Pflichtfelder ausfüllen');
      return;
    }
    setSubmittingAdhoc(true);
    try {
      const res = await apiFetch('/api/billing/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          club_id: clubId,
          member_id: adhocMemberId,
          due_date: adhocDueDate,
          notes: adhocNotes || undefined,
          items: adhocItems,
        }),
      });
      if (res.ok) {
        toast.success('Zusatz-Rechnung erstellt');
        setShowAdhocDialog(false);
        setAdhocMemberId('');
        setAdhocDueDate('');
        setAdhocNotes('');
        setAdhocItems([{ description: '', quantity: 1, unit_price: 0 }]);
        // Re-trigger invoice fetch
        setInvoiceTypeFilter((prev) => prev);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(`Fehler: ${err.error || 'Unbekannt'}`);
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setSubmittingAdhoc(false);
    }
  };

  /** Re-fetch data after mutations by refreshing the server component */
  const refreshData = () => router.refresh();

  const handleAssignPlan = async () => {
    if (!selectedMember) return;
    try {
      const res = await apiFetch('/api/admin/billing/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: selectedMember.id,
          plan: selectedPlan,
        }),
      });

      if (res.ok) {
        toast.success('Abonnement erfolgreich zugewiesen');
        setShowAssignDialog(false);
        setSelectedMember(null);
        refreshData();
      } else {
        const error = await res.json();
        toast.error(`Fehler: ${error.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      console.error('Failed to assign plan:', err);
      toast.error('Fehler bei der Zuweisung');
    }
  };

  const handleGenerateInvoices = async () => {
    setGeneratingInvoices(true);
    try {
      const res = await apiFetch('/api/billing/generate-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.warning === 'NO_FEE_CONFIGURED') {
          toast.warning(data.message ?? 'Keine aktive Mitgliedsgebühr');
        } else {
          toast.success(data.message ?? `${data.created} Rechnung(en) erstellt`);
        }
        // Switch to invoices tab with membership filter — useEffect handles the API fetch
        setActiveTab('invoices');
        setInvoiceTypeFilter('membership');
      } else {
        toast.error(data.error ?? 'Fehler beim Generieren der Rechnungen');
      }
    } catch (err) {
      console.error('Failed to generate invoices:', err);
      toast.error('Netzwerkfehler');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Abrechnung</h1>
          <p className="text-muted-foreground">Mitgliederabonnements und Rechnungen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateInvoices} disabled={generatingInvoices}>
            {generatingInvoices ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Rechnungen generieren
          </Button>
          <CreateInvoiceDialog onSuccess={refreshData} members={clubMembers} />
          <PaymentImportDialog />
          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogTrigger asChild>
              <Button>
                <span className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Abonnement zuweisen
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abonnement zuweisen</DialogTitle>
                <DialogDescription>Weise einem Mitglied einen Tarif zu</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="member">Mitglied</Label>
                  <Select
                    value={selectedMember?.id || ''}
                    onValueChange={(v) => {
                      const member = clubMembers.find((m) => m.id === v);
                      setSelectedMember(member || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Mitglied wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {clubMembers.length > 0 ? (
                        clubMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} ({member.email})
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-4 text-sm text-muted-foreground">
                          Keine Mitglieder gefunden
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="plan">Tarif</Label>
                  <Select
                    value={selectedPlan}
                    onValueChange={(v) => setSelectedPlan(v as Subscription['plan'])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (0€)</SelectItem>
                      <SelectItem value="pro">Pro (29,99€/Monat)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (99€/Monat)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleAssignPlan}>Zuweisen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'subscriptions'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Plattform-Abos ({subscriptions.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Rechnungen ({invoices.length})
          </div>
        </button>
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <Card>
          <CardHeader>
            <CardTitle>Mitgliederabonnements</CardTitle>
            <CardDescription>Übersicht aller aktiven und vergangenen Abonnements</CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Noch keine Abonnements vorhanden</p>
                <Button variant="link" onClick={() => setShowAssignDialog(true)}>
                  Erstes Abonnement zuweisen
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitglied</TableHead>
                    <TableHead>Tarif</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nächste Verlängerung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{sub.memberName}</div>
                          <div className="text-sm text-muted-foreground">{sub.memberEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {getPlanLabel(sub.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`capitalize ${getStatusColor(sub.status)}`}>
                          {sub.status === 'active'
                            ? 'Aktiv'
                            : sub.status === 'canceled'
                              ? 'Gekündigt'
                              : sub.status === 'past_due'
                                ? 'Überfällig'
                                : sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(sub.currentPeriodEnd).toLocaleDateString('de-DE')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Rechnungen</CardTitle>
                <CardDescription>Alle generierten Rechnungen</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAdhocDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Neue Zusatz-Rechnung
              </Button>
            </div>
            {/* Invoice type filter tabs */}
            <div className="flex gap-3 border-b mt-4">
              {(['all', 'season', 'membership', 'adhoc'] as InvoiceTypeFilter[]).map((t) => {
                const labels: Record<InvoiceTypeFilter, string> = {
                  all: 'Alle',
                  season: 'Saison',
                  membership: 'Mitgliedsbeitrag',
                  adhoc: 'Zusatz',
                };
                return (
                  <button
                    key={t}
                    onClick={() => setInvoiceTypeFilter(t)}
                    className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                      invoiceTypeFilter === t
                        ? 'border-brand-primary text-brand-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {labels[t]}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Laden…
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Noch keine Rechnungen erstellt</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Mitglied</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead className="text-right">Bezahlt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fällig</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">
                        {invoice.invoiceDate
                          ? new Date(invoice.invoiceDate).toLocaleDateString('de-DE')
                          : '-'}
                      </TableCell>
                      <TableCell>{invoice.memberName}</TableCell>
                      <TableCell>
                        {invoice.invoiceType ? (
                          <InvoiceTypeBadge type={invoice.invoiceType} />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {invoice.subtotal.toFixed(2)} {invoice.currency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {invoice.amount.toFixed(2)} {invoice.currency}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {invoice.paidAmount > 0 ? (
                          <span
                            className={
                              invoice.paidAmount >= invoice.amount
                                ? 'text-green-600'
                                : 'text-orange-600'
                            }
                          >
                            {invoice.paidAmount.toFixed(2)} {invoice.currency}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString('de-DE')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {(invoice.status === 'draft' || invoice.status === 'open') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSendInvoice(invoice.id)}
                              disabled={sendingInvoiceId === invoice.id}
                            >
                              {sendingInvoiceId === invoice.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              Per E-Mail senden
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                            title="PDF herunterladen"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice Pagination (only when no type filter — filtered data comes from unpaginated API) */}
      {activeTab === 'invoices' &&
        invoiceTypeFilter === 'all' &&
        invoicePagination &&
        invoicePagination.totalPages > 1 &&
        searchParams && (
          <PaginationNav
            meta={invoicePagination}
            buildUrl={(p) => `?${buildPageUrl(searchParams, p)}`}
            compact
            className="mt-2"
          />
        )}

      {/* Adhoc Invoice Dialog */}
      <Dialog open={showAdhocDialog} onOpenChange={setShowAdhocDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neue Zusatz-Rechnung</DialogTitle>
            <DialogDescription>Erstelle eine manuelle Rechnung für ein Mitglied</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="adhoc-member">Mitglied *</Label>
                <Select value={adhocMemberId} onValueChange={setAdhocMemberId}>
                  <SelectTrigger id="adhoc-member">
                    <SelectValue placeholder="Mitglied wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adhoc-due">Fälligkeitsdatum *</Label>
                <Input
                  id="adhoc-due"
                  type="date"
                  value={adhocDueDate}
                  onChange={(e) => setAdhocDueDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="adhoc-notes">Notizen</Label>
              <Input
                id="adhoc-notes"
                value={adhocNotes}
                onChange={(e) => setAdhocNotes(e.target.value)}
                placeholder="Optionale Anmerkungen"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Positionen *</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Position hinzufügen
                </Button>
              </div>
              <div className="space-y-2">
                {adhocItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center"
                  >
                    <Input
                      placeholder="Beschreibung"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Anz."
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                      }
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Preis €"
                      value={item.unit_price}
                      onChange={(e) =>
                        updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeItem(idx)}
                      disabled={adhocItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right text-sm font-medium text-foreground">
                Gesamt: {adhocTotal} €
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdhocDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitAdhoc} disabled={submittingAdhoc}>
              {submittingAdhoc && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rechnung erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
