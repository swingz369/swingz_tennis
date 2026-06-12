'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, Plus, FileText, Loader2, Trash2, Send } from 'lucide-react';
import CreateInvoiceDialog from '@/components/billing/create-invoice-dialog';
import PaymentImportDialog from '@/components/billing/payment-import-dialog';
import { PaginationNav } from '@/components/ui/pagination-nav';
import { buildPageUrl } from '@/lib/pagination';
import type { PaginationMeta } from '@/lib/pagination';
import { apiFetch } from '@/lib/api-fetch';

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
  initialInvoices: Invoice[];
  members: { id: string; name: string; email: string; role?: string }[];
  clubId?: string | null;
  invoicePagination?: PaginationMeta;
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function BillingClient({
  initialInvoices,
  members,
  clubId,
  invoicePagination,
  searchParams,
}: BillingClientProps) {
  const router = useRouter();
  const clubMembers = members as ((typeof members)[number] & { role?: string })[];
  const [memberSearch, setMemberSearch] = useState('');
  const filteredMembers = clubMembers.filter((m) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

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
    if (!clubId) return;
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
  }, [clubId, invoiceTypeFilter, initialInvoices]);

  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const selectableInvoices = invoices.filter((inv) => inv.status !== 'paid');
  const allSelected =
    selectableInvoices.length > 0 && selectableInvoices.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableInvoices.map((inv) => inv.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await apiFetch(`/api/billing/invoices/${id}`, { method: 'DELETE' });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      })
    );
    if (successCount > 0) {
      toast.success(`${successCount} Rechnung${successCount !== 1 ? 'en' : ''} gelöscht`);
      setInvoices((prev) => prev.filter((inv) => !selectedIds.has(inv.id)));
    }
    if (failCount > 0) {
      toast.error(
        `${failCount} Rechnung${failCount !== 1 ? 'en' : ''} konnte${failCount === 1 ? 'te' : 'n'} nicht gelöscht werden`
      );
    }
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
    setBulkDeleting(false);
  };

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

  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeletingInvoiceId(invoiceToDelete.id);
    try {
      const res = await apiFetch(`/api/billing/invoices/${invoiceToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Rechnung gelöscht');
        setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete.id));
        setDeleteConfirmOpen(false);
        setInvoiceToDelete(null);
      } else {
        const err = await res.json();
        toast.error(err.error ?? 'Fehler beim Löschen');
      }
    } catch {
      toast.error('Netzwerkfehler beim Löschen');
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  /** Re-fetch data after mutations by refreshing the server component */
  const refreshData = () => router.refresh();

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
        // Switch to membership invoice filter — useEffect handles the API fetch
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
          <p className="text-muted-foreground">Rechnungen und Abrechnungen verwalten</p>
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
        </div>
      </div>

      {/* Invoices */}
      {
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
                    onClick={() => {
                      setInvoiceTypeFilter(t);
                      setSelectedIds(new Set());
                    }}
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
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected || (someSelected ? 'indeterminate' : false)}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Alle auswählen"
                      />
                    </TableHead>
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
                    <TableRow key={invoice.id} data-selected={selectedIds.has(invoice.id)}>
                      <TableCell className="w-10">
                        {invoice.status === 'paid' ? (
                          <span className="block w-4 h-4" />
                        ) : (
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={() => toggleSelect(invoice.id)}
                            aria-label={`Rechnung ${invoice.invoiceNumber} auswählen`}
                          />
                        )}
                      </TableCell>
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
                          {invoice.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setInvoiceToDelete(invoice);
                                setDeleteConfirmOpen(true);
                              }}
                              title="Rechnung löschen"
                            >
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      }

      {/* Invoice Pagination (only when no type filter — filtered data comes from unpaginated API) */}
      {invoiceTypeFilter === 'all' &&
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

      {/* Bulk Selection Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} Rechnung{selectedIds.size !== 1 ? 'en' : ''} ausgewählt
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            Auswahl aufheben
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirmOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Ausgewählte löschen
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <CenteredModal open={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-red-600">
            {selectedIds.size} Rechnung{selectedIds.size !== 1 ? 'en' : ''} löschen?
          </h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>Folgende Rechnungen werden gelöscht:</p>
            <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/50 p-2 space-y-1">
              {Array.from(selectedIds).map((id) => {
                const inv = invoices.find((i) => i.id === id);
                if (!inv) return null;
                return (
                  <div key={id} className="flex items-center justify-between text-xs">
                    <span className="font-mono">{inv.invoiceNumber}</span>
                    <span>{inv.memberName}</span>
                    <span className="font-medium tabular-nums">
                      {inv.amount.toFixed(2)} {inv.currency}
                    </span>
                  </div>
                );
              })}
            </div>
            {Array.from(selectedIds).some((id) => {
              const inv = invoices.find((i) => i.id === id);
              return inv && !['draft', 'open'].includes(inv.status);
            }) && (
              <p className="text-amber-600 font-medium">
                ⚠️ Einige Rechnungen wurden bereits versendet oder haben Zahlungen erhalten.
              </p>
            )}
            <p>Diese Aktion kann nicht rückgängig gemacht werden.</p>
          </div>
        </div>
        <div className="flex gap-2 pt-4 justify-end">
          <Button
            variant="outline"
            onClick={() => setBulkDeleteConfirmOpen(false)}
            disabled={bulkDeleting}
          >
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
            {bulkDeleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {selectedIds.size} Rechnung{selectedIds.size !== 1 ? 'en' : ''} löschen
          </Button>
        </div>
      </CenteredModal>

      {/* Single Delete Confirmation Dialog */}
      <CenteredModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setInvoiceToDelete(null);
        }}
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-red-600">Rechnung löschen?</h2>
          <p className="text-sm text-muted-foreground">
            Möchtest du Rechnung <strong>{invoiceToDelete?.invoiceNumber}</strong> wirklich löschen?
            {invoiceToDelete && !['draft', 'open'].includes(invoiceToDelete.status) && (
              <span className="block mt-1 text-amber-600 font-medium">
                ⚠️ Diese Rechnung wurde bereits versendet oder hat Zahlungen erhalten.
              </span>
            )}
            <span className="block mt-1">Diese Aktion kann nicht rückgängig gemacht werden.</span>
          </p>
        </div>
        <div className="flex gap-2 pt-4 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setDeleteConfirmOpen(false);
              setInvoiceToDelete(null);
            }}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteInvoice}
            disabled={!!deletingInvoiceId}
          >
            {deletingInvoiceId ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Löschen
          </Button>
        </div>
      </CenteredModal>

      {/* Adhoc Invoice Dialog */}
      <CenteredModal open={showAdhocDialog} onClose={() => setShowAdhocDialog(false)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold">Neue Zusatz-Rechnung</h2>
          <p className="text-sm text-muted-foreground">
            Erstelle eine manuelle Rechnung für ein Mitglied
          </p>
        </div>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            {' '}
            <div>
              <Label htmlFor="adhoc-member">Mitglied / Trainer *</Label>
              <div className="relative">
                <Input
                  id="adhoc-member"
                  placeholder="Name oder E-Mail suchen..."
                  value={
                    adhocMemberId
                      ? (clubMembers.find((m) => m.id === adhocMemberId)?.name ?? '')
                      : memberSearch
                  }
                  onChange={(e) => {
                    setAdhocMemberId('');
                    setMemberSearch(e.target.value);
                  }}
                  onBlur={() => setTimeout(() => setMemberSearch(''), 200)}
                />
                {adhocMemberId && (
                  <button
                    onClick={() => {
                      setAdhocMemberId('');
                      setMemberSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>
              {!adhocMemberId && memberSearch.trim().length > 0 && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-md">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setAdhocMemberId(m.id);
                          setMemberSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>
                          {m.name} <span className="text-muted-foreground">({m.email})</span>
                        </span>
                        {m.role && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              m.role === 'trainer'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {m.role === 'trainer' ? 'Trainer' : 'Mitglied'}
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Keine Ergebnisse für „{memberSearch}"
                    </div>
                  )}
                </div>
              )}
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
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center">
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
                    onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Preis €"
                    value={item.unit_price}
                    onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
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
        <div className="flex gap-2 pt-2 justify-end">
          <Button variant="outline" onClick={() => setShowAdhocDialog(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmitAdhoc} disabled={submittingAdhoc}>
            {submittingAdhoc && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Rechnung erstellen
          </Button>
        </div>
      </CenteredModal>
    </div>
  );
}
