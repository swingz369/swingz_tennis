import { requireAuth } from '@/lib/auth';
import { TrainerOwnBilling } from '@/components/trainer-own-billing';

export default async function TrainerBillingPage() {
  await requireAuth();
  return <TrainerOwnBilling />;
}
