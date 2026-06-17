'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, Tag, FileDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import FeeCategoriesClient from './categories/fee-categories-client';

interface FeeConfig {
  id: string;
  name: string;
  type: string;
  amount: number;
  billing_cycle: string;
  is_active: boolean;
}

function SepaExportTab() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSepaExport = async (paymentIds: string[]) => {
    setIsLoading(true);
    try {
      const executionDate = new Date().toISOString().split('T')[0];
      const response = await apiFetch('/api/billing/sepa/pain008', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIds, executionDate }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error ?? 'SEPA-Export fehlgeschlagen');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sepa-pain008-${executionDate}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('SEPA-XML erfolgreich heruntergeladen');
    } catch {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-brand-primary" />
          <p>
            Wähle in der Rechnungsliste die gewünschten SEPA-Zahlungen aus und klicke dann{' '}
            <strong>SEPA exportieren</strong> — oder exportiere hier direkt mit konkreten
            Zahlungs-IDs.
          </p>
        </div>
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-3">
            Um alle ausstehenden SEPA-Zahlungen zu exportieren, wähle sie zunächst in der
            Rechnungsübersicht aus.
          </p>
          <Button
            variant="outline"
            disabled={isLoading}
            onClick={() => handleSepaExport([])}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {isLoading ? 'Exportiere...' : 'SEPA-XML herunterladen'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingCategoriesTabs({
  children,
  initialCategories,
  clubId,
  defaultTab = 'invoices',
}: {
  children: React.ReactNode;
  initialCategories: FeeConfig[];
  clubId: string;
  defaultTab?: string;
}) {
  const tab = ['categories', 'sepa'].includes(defaultTab) ? defaultTab : 'invoices';
  return (
    <Tabs defaultValue={tab} className="space-y-6">
      <TabsList className="w-full max-w-lg grid grid-cols-3 bg-muted dark:bg-card/5 p-1 rounded-xl">
        <TabsTrigger
          value="invoices"
          className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Rechnungen
        </TabsTrigger>
        <TabsTrigger
          value="categories"
          className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <Tag className="h-4 w-4 mr-2" />
          Kategorien
        </TabsTrigger>
        <TabsTrigger
          value="sepa"
          className="rounded-lg data-[state=active]:bg-background dark:data-[state=active]:bg-surface-dark data-[state=active]:text-brand-primary data-[state=active]:shadow-sm"
        >
          <FileDown className="h-4 w-4 mr-2" />
          SEPA-Export
        </TabsTrigger>
      </TabsList>

      {/* Rechnungen Tab — renders the existing BillingClient */}
      <TabsContent value="invoices">{children}</TabsContent>

      {/* Kategorien Tab — reuses FeeCategoriesClient */}
      <TabsContent value="categories">
        <FeeCategoriesClient clubId={clubId} initialCategories={initialCategories} />
      </TabsContent>

      {/* SEPA-Export Tab */}
      <TabsContent value="sepa">
        <SepaExportTab />
      </TabsContent>
    </Tabs>
  );
}
