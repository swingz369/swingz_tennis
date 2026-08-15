'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { NoInvoicesBrandedEmptyState } from '@/components/ui/empty-state';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { CenteredModal } from '@/components/ui/centered-modal';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Loader2, Trash2, Send, Sparkles } from 'lucide-react';
import CreateInvoiceDialog from '@/components/billing/create-invoice-dialog';
import PaymentImportDialog from '@/components/billing/payment-import-dialog';
import { InvoiceTypeBadge } from '@/components/billing/invoice-type-badge';
import { PaginationNav } from '@/components/ui/pagination-nav';
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

interface BillingClientProps {
  initialInvoices: Invoice[];
  members: { id: string; name: string; email: string; role?: string }[];
  clubId?: string | null;
  invoicePagination?: PaginationMeta;
}

export default function BillingClient({
  initialInvoices,
  members,
  clubId,
  invoicePagination,
}: BillingClientProps) {
  const router = useRouter();
  const clubMembers = members as ((typeof members)[number] & { role?: string })[];
  const [generatingInvoices, setGeneratingInvoices] = useState(false);

  // Invoice generation preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    members: {
      memberId: string;
      memberName: string;
      email: string;
      amount: number;
      subtotal: number;
      taxAmount: number;
    }[];
    alreadyBilled: { memberId: string; memberName: string }[];
    feeAmount: number;
    feeName: string | null;
    currency: string;
    taxRate: number;
    month: string;
    warning?: string;
  } | null>(null);
  const [previewExcluded, setPreviewExcluded] = useState<Set<string>>(new Set());

  // Invoice type filter + pagination — both drive a client-side re-fetch of just
  // the invoice table (no full page reload, no server component round-trip)
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>('all');
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [page, setPage] = useState(invoicePagination?.page ?? 1);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>(invoicePagination);
  const limit = invoicePagination?.limit ?? 25;

  const fetchInvoices = useCallback(
    async (targetPage: number, filter: InvoiceTypeFilter) => {
      if (!clubId) return;
      setLoadingInvoices(true);
      try {
        const params = new URLSearchParams({
          clubId,
          page: String(targetPage),
          limit: String(limit),
        });
        if (filter !== 'all') params.set('type', filter);
        const res = await apiFetch(`/api/admin/billing/invoices?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? 'Fehler beim Laden der Rechnungen');
          return;
        }
        const meta = json.pagination as PaginationMeta | undefined;
        // Deleted the last invoice(s) of a page? Rewind to the new last page
        // instead of leaving the table empty — the effect below re-fetches it.
        if (meta && targetPage > meta.totalPages) {
          setPage(meta.totalPages);
          return;
        }
        setInvoices(
          (json.data as Record<string, unknown>[]).map(
            (inv) =>
              ({
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
              }) as Invoice
          )
        );
        if (meta) setPagination(meta);
      } catch {
        toast.error('Fehler beim Laden der Rechnungen');
      } finally {
        setLoadingInvoices(false);
      }
    },
    [clubId, limit]
  );

  // Skip the very first run — page 1 / filter "all" is already server-rendered
  // into initialInvoices, so fetching it again on mount would be wasted work.
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    fetchInvoices(page, invoiceTypeFilter);
  }, [page, invoiceTypeFilter, fetchInvoices]);

  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  // Entwürfe sind für Mitglieder unsichtbar (lib/billing/invoice-visibility.ts) —
  // sie müssen aktiv versendet werden, sonst sieht niemand eine Forderung.
  const draftInvoiceIds = invoices.filter((inv) => inv.status === 'draft').map((inv) => inv.id);
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
      // Re-fetch the current page so the next invoices slide up to fill the gap
      // instead of leaving deleted rows as an empty page.
      await fetchInvoices(page, invoiceTypeFilter);
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

  /**
   * Versendet mehrere Rechnungen nacheinander über dieselbe Route wie der
   * Einzelversand. Bewusst seriell: Jeder Versand erzeugt ein PDF und eine Mail,
   * und bei einem Teilfehler muss erkennbar bleiben, welche Rechnung betroffen ist.
   */
  const handleSendMany = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkSending(true);
    const sent: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        const res = await apiFetch(`/api/billing/invoices/${id}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) sent.push(id);
        else failed.push({ id, error: data.error ?? `HTTP ${res.status}` });
      } catch {
        failed.push({ id, error: 'Netzwerkfehler' });
      }
    }

    if (sent.length > 0) {
      setInvoices((prev) =>
        prev.map((inv) => (sent.includes(inv.id) ? { ...inv, status: 'sent' } : inv))
      );
      setSelectedIds(new Set());
    }

    if (failed.length === 0) {
      toast.success(`${sent.length} Rechnung${sent.length !== 1 ? 'en' : ''} versendet`);
    } else {
      // Der häufigste Grund ist eine nicht verifizierte Absenderdomain — dann
      // scheitern alle. Die erste Fehlermeldung sagt mehr als eine Zahl.
      toast.error(
        `${sent.length} versendet, ${failed.length} fehlgeschlagen — ${failed[0].error}`,
        { duration: 12000 }
      );
    }
    setBulkSending(false);
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
        // Re-fetch the current page so the next invoice slides up to fill the gap.
        await fetchInvoices(page, invoiceTypeFilter);
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

  const handleOpenPreview = async () => {
    setPreviewLoading(true);
    setPreviewExcluded(new Set());
    try {
      const res = await apiFetch('/api/billing/generate-invoices');
      const data = await res.json();
      if (res.ok) {
        setPreviewData(data);
        setPreviewOpen(true);
        if (data.warning === 'NO_FEE_CONFIGURED') {
          toast.warning('Keine aktive Mitgliedsgebühr konfiguriert');
        }
      } else {
        toast.error(data.error ?? 'Fehler beim Laden der Vorschau');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmGenerate = async () => {
    if (!previewData) return;
    setGeneratingInvoices(true);
    try {
      const excludeMemberIds = Array.from(previewExcluded);
      const res = await apiFetch('/api/billing/generate-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludeMemberIds }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? `${data.created} Rechnung(en) erstellt`);
        setInvoiceTypeFilter('membership');
        setPage(1);
        // Fetch directly — setState above is a no-op re-run trigger if the
        // filter/page were already 'membership'/1 before this action.
        await fetchInvoices(1, 'membership');
        setPreviewOpen(false);
        setPreviewData(null);
      } else {
        toast.error(data.error ?? 'Fehler beim Generieren der Rechnungen');
      }
    } catch {
      toast.error('Netzwerkfehler');
    } finally {
      setGeneratingInvoices(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end items-center">
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={handleOpenPreview} disabled={previewLoading}>
            {previewLoading ? (
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
            <div>
              <CardTitle>Rechnungen</CardTitle>
              <CardDescription>Alle generierten Rechnungen</CardDescription>
            </div>
            {/* Bulk actions bar — inline when invoices are selected via header checkbox or row checkboxes */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium text-primary">
                  {selectedIds.size} Rechnung{selectedIds.size !== 1 ? 'en' : ''} ausgewählt
                </span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Auswahl aufheben
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkSending}
                  onClick={() => handleSendMany([...selectedIds])}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {bulkSending ? 'Versand läuft…' : 'Ausgewählte versenden'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Ausgewählte löschen
                </Button>
              </div>
            )}
            {/* Ohne Sammelversand wären es bei einem Verein mit 20 Mitgliedern
                20 Einzelklicks — die Rechnungen bleiben dann als Entwurf liegen
                und das Mitglied sieht nie eine Forderung. */}
            {selectedIds.size === 0 && draftInvoiceIds.length > 0 && (
              <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800">
                <span className="text-sm">
                  {draftInvoiceIds.length} Rechnung{draftInvoiceIds.length !== 1 ? 'en' : ''} im
                  Entwurf — für Mitglieder noch nicht sichtbar
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  disabled={bulkSending}
                  onClick={() => handleSendMany(draftInvoiceIds)}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {bulkSending ? 'Versand läuft…' : 'Alle Entwürfe versenden'}
                </Button>
              </div>
            )}
            {/* Invoice type filter tabs */}
            <div className="flex gap-3 border-b mt-4 overflow-x-auto">
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
                      setPage(1);
                    }}
                    className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                      invoiceTypeFilter === t
                        ? 'border-primary text-primary'
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
              <NoInvoicesBrandedEmptyState />
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
                                ? 'text-success-600'
                                : 'text-brand-accent-600'
                            }
                          >
                            {invoice.paidAmount.toFixed(2)} {invoice.currency}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} size="sm" />
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
                            aria-label="PDF herunterladen"
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
                              aria-label="Rechnung löschen"
                            >
                              <Trash2 className="h-3 w-3 text-error-400" />
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

      {/* Invoice Pagination — client-side page swap, no full page reload */}
      {pagination && pagination.totalPages > 1 && (
        <PaginationNav meta={pagination} onPageChange={setPage} compact className="mt-2" />
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <CenteredModal open={bulkDeleteConfirmOpen} onClose={() => setBulkDeleteConfirmOpen(false)}>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-error-600">
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
              <p className="text-warning-600 font-medium">
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
          <h2 className="text-lg font-bold text-error-600">Rechnung löschen?</h2>
          <p className="text-sm text-muted-foreground">
            Möchtest du Rechnung <strong>{invoiceToDelete?.invoiceNumber}</strong> wirklich löschen?
            {invoiceToDelete && !['draft', 'open'].includes(invoiceToDelete.status) && (
              <span className="block mt-1 text-warning-600 font-medium">
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

      {/* Invoice Generation Preview Modal */}
      <CenteredModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewData(null);
        }}
      >
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Rechnungen generieren
          </h2>
          <p className="text-sm text-muted-foreground">
            {previewData ? (
              <>
                Vorschau für{' '}
                <strong>
                  {new Date(previewData.month + '-01').toLocaleDateString('de-DE', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
              </>
            ) : (
              'Lade Vorschau...'
            )}
          </p>
        </div>

        {previewData && (
          <div className="space-y-4 py-2">
            {/* Fee info */}
            {previewData.warning === 'NO_FEE_CONFIGURED' ? (
              <div className="bg-warning-50 border border-warning-200 rounded-xl p-3">
                <p className="text-sm text-warning-800 font-medium">
                  Keine aktive Mitgliedsgebühr konfiguriert.
                </p>
                <p className="text-xs text-warning-700 mt-1">
                  Bitte zuerst eine Gebühr vom Typ „Mitgliedschaft" anlegen.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm bg-muted/50 rounded-xl p-3">
                  <span className="text-muted-foreground">Gebühr:</span>
                  <span className="font-medium">
                    {previewData.feeName || 'Mitgliedsbeitrag'} — {previewData.feeAmount.toFixed(2)}{' '}
                    {previewData.currency}
                    {previewData.taxRate > 0 ? ` (+ ${previewData.taxRate}% MwSt.)` : ''}
                  </span>
                </div>

                {/* Already billed notice */}
                {previewData.alreadyBilled.length > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
                    <span className="font-medium">
                      {previewData.alreadyBilled.length} Mitglied
                      {previewData.alreadyBilled.length !== 1 ? 'er' : ''} bereits abgerechnet
                    </span>
                    <span className="ml-1">(werden übersprungen)</span>
                  </div>
                )}

                {/* Member list with checkboxes */}
                {previewData.members.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-sm">
                      Alle Mitglieder wurden bereits für diesen Monat abgerechnet.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {previewData.members.length - previewExcluded.size} von{' '}
                        {previewData.members.length} Mitgliedern ausgewählt
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          if (previewExcluded.size === 0) {
                            setPreviewExcluded(new Set(previewData.members.map((m) => m.memberId)));
                          } else {
                            setPreviewExcluded(new Set());
                          }
                        }}
                      >
                        {previewExcluded.size === 0 ? 'Alle abwählen' : 'Alle auswählen'}
                      </Button>
                    </div>
                    <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border/50">
                      {previewData.members.map((m) => {
                        const excluded = previewExcluded.has(m.memberId);
                        return (
                          <label
                            key={m.memberId}
                            className={`flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                              excluded ? 'bg-muted/30 opacity-60' : 'hover:bg-muted/20'
                            }`}
                          >
                            <Checkbox
                              checked={!excluded}
                              onCheckedChange={() => {
                                setPreviewExcluded((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(m.memberId)) {
                                    next.delete(m.memberId);
                                  } else {
                                    next.add(m.memberId);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium truncate block">{m.memberName}</span>
                              <span className="text-xs text-muted-foreground">{m.email}</span>
                            </div>
                            <span className="font-mono text-xs font-medium tabular-nums whitespace-nowrap">
                              {m.amount.toFixed(2)} {previewData.currency}
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t">
                      <span>
                        Gesamt ({previewData.members.length - previewExcluded.size} Rechnungen)
                      </span>
                      <span className="tabular-nums">
                        {previewData.members
                          .filter((m) => !previewExcluded.has(m.memberId))
                          .reduce((sum, m) => sum + m.amount, 0)
                          .toFixed(2)}{' '}
                        {previewData.currency}
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setPreviewOpen(false);
              setPreviewData(null);
            }}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirmGenerate}
            disabled={
              generatingInvoices ||
              !previewData ||
              previewData.members.length === 0 ||
              previewData.members.length - previewExcluded.size === 0 ||
              previewData.warning === 'NO_FEE_CONFIGURED'
            }
          >
            {generatingInvoices ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {previewData
              ? `${previewData.members.length - previewExcluded.size} Rechnung${previewData.members.length - previewExcluded.size !== 1 ? 'en' : ''} erstellen`
              : 'Generieren'}
          </Button>
        </div>
      </CenteredModal>
    </div>
  );
}
