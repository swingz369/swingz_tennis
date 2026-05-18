'use client';

import { useState } from 'react';
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
import { CreditCard, DollarSign, Plus, Eye, FileText, Loader2 } from 'lucide-react';
import CreateInvoiceDialog from '@/components/billing/create-invoice-dialog';
import PaymentImportDialog from '@/components/billing/payment-import-dialog';

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
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: string;
  paidAt?: string;
  stripeInvoiceId?: string;
};

interface BillingClientProps {
  initialSubscriptions: Subscription[];
  initialInvoices: Invoice[];
  members: { id: string; name: string; email: string }[];
}

// Demo members for the subscription assignment dialog
function getStatusColor(status: string) {
  switch (status) {
    case 'active':
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'canceled':
      return 'bg-gray-100 text-gray-700';
    case 'past_due':
      return 'bg-yellow-100 text-yellow-700';
    case 'unpaid':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
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
}: BillingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'invoices'>('subscriptions');
  // Derive directly from props — router.refresh() re-renders the server component
  // which passes fresh data as new props. No local state needed.
  const subscriptions = initialSubscriptions;
  const invoices = initialInvoices;
  const clubMembers = members;
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Subscription['plan']>('pro');

  /** Re-fetch data after mutations by refreshing the server component */
  const refreshData = () => router.refresh();

  const handleAssignPlan = async () => {
    if (!selectedMember) return;
    try {
      const res = await fetch('/api/admin/billing/subscriptions', {
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
      const res = await fetch('/api/billing/generate-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? `${data.created} Rechnung(en) erstellt`);
        refreshData();
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
          <p className="text-gray-500">Mitgliederabonnements und Rechnungen</p>
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
                        <div className="px-2 py-4 text-sm text-gray-500">
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
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Abonnements ({subscriptions.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-1 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
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
              <div className="text-center py-8 text-gray-500">
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
                          <div className="text-sm text-gray-500">{sub.memberEmail}</div>
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
            <CardTitle>Rechnungen</CardTitle>
            <CardDescription>Alle generierten Rechnungen</CardDescription>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Noch keine Rechnungen erstellt</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Mitglied</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fälligkeitsdatum</TableHead>
                    <TableHead>Bezahlt am</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{invoice.memberName}</TableCell>
                      <TableCell>
                        {invoice.amount.toFixed(2)} {invoice.currency}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusColor(invoice.status)} capitalize`}>
                          {invoice.status === 'paid'
                            ? 'Bezahlt'
                            : invoice.status === 'open'
                              ? 'Offen'
                              : invoice.status === 'void'
                                ? 'Storniert'
                                : invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString('de-DE')}</TableCell>
                      <TableCell>
                        {invoice.paidAt
                          ? new Date(invoice.paidAt).toLocaleDateString('de-DE')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
