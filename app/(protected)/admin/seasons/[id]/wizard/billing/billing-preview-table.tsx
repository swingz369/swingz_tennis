'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

type PreviewItem = {
  memberId: string;
  memberName: string;
  groupId: string;
  amount: number;
  feeConfigId: string | null;
  billingCycle: string;
  installments: number;
};

type EditableItem = PreviewItem & {
  editAmount: string;
  editInstallments: string;
};

export function BillingPreviewTable({
  seasonId,
  preview,
}: {
  seasonId: string;
  preview: PreviewItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[]>(
    preview.map((p) => ({
      ...p,
      editAmount: String(p.amount),
      editInstallments: String(p.installments),
    }))
  );
  const [generating, setGenerating] = useState(false);

  function updateAmount(memberId: string, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.memberId === memberId ? { ...item, editAmount: value } : item))
    );
  }

  function updateInstallments(memberId: string, value: string) {
    setItems((prev) =>
      prev.map((item) => (item.memberId === memberId ? { ...item, editInstallments: value } : item))
    );
  }

  async function generateInvoices() {
    setGenerating(true);
    const payload = items.map((item) => ({
      memberId: item.memberId,
      memberName: item.memberName,
      groupId: item.groupId,
      amount: parseFloat(item.editAmount) || item.amount,
      feeConfigId: item.feeConfigId,
      billingCycle: item.billingCycle,
      installments: parseInt(item.editInstallments, 10) || item.installments,
      override: {
        amount: parseFloat(item.editAmount) || item.amount,
        installments: parseInt(item.editInstallments, 10) || item.installments,
      },
    }));

    try {
      const res = await fetch(`/api/seasons/${seasonId}/wizard/billing-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Fehler beim Generieren der Rechnungen');
        setGenerating(false);
        return;
      }
      toast.success(`${data.generated} Rechnung(en) erstellt`);
      router.push(`/admin/seasons/${seasonId}/wizard/publish`);
      router.refresh();
    } catch {
      toast.error('Netzwerkfehler');
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mitglied</TableHead>
              <TableHead>Betrag (CHF)</TableHead>
              <TableHead>Raten</TableHead>
              <TableHead>Zyklus</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Keine Einträge gefunden.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.memberId}>
                  <TableCell className="font-medium">{item.memberName || item.memberId}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-28"
                      value={item.editAmount}
                      onChange={(e) => updateAmount(item.memberId, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={item.editInstallments}
                      onChange={(e) => updateInstallments(item.memberId, e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.billingCycle === 'installment' ? 'secondary' : 'outline'}>
                      {item.billingCycle === 'installment' ? 'Raten' : 'Saison'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push(`/admin/seasons/${seasonId}/wizard/publish`)}
        >
          Überspringen
        </Button>
        <Button onClick={generateInvoices} disabled={generating || items.length === 0}>
          {generating ? 'Generieren...' : 'Alle Rechnungen generieren'}
        </Button>
      </div>
    </div>
  );
}
