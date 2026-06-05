'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CreditCard, Tag } from 'lucide-react';
import FeeCategoriesClient from './categories/fee-categories-client';

interface FeeConfig {
  id: string;
  name: string;
  type: string;
  amount: number;
  billing_cycle: string;
  is_active: boolean;
}

export function BillingCategoriesTabs({
  children,
  initialCategories,
  clubId,
}: {
  children: React.ReactNode;
  initialCategories: FeeConfig[];
  clubId: string;
}) {
  return (
    <Tabs defaultValue="invoices" className="space-y-6">
      <TabsList className="w-full max-w-md grid grid-cols-2 bg-muted dark:bg-card/5 p-1 rounded-xl">
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
      </TabsList>

      {/* Rechnungen Tab — renders the existing BillingClient */}
      <TabsContent value="invoices">{children}</TabsContent>

      {/* Kategorien Tab — reuses FeeCategoriesClient */}
      <TabsContent value="categories">
        <FeeCategoriesClient clubId={clubId} initialCategories={initialCategories} />
      </TabsContent>
    </Tabs>
  );
}
