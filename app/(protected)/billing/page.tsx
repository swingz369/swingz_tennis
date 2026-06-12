import { Suspense } from 'react';
import MemberBilling from '@/components/member-billing';

export default function MemberBillingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-center py-12 text-muted-foreground">Laden...</div>
        </div>
      }
    >
      <MemberBilling />
    </Suspense>
  );
}
