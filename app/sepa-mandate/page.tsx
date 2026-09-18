import SEPAMandateSigning from '@/components/sepa-mandate-signing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SEPA-Lastschriftmandat | SWINGZ',
  description: 'SEPA-Lastschriftmandat für die Lastschrift-Zahlung bei SWINGZ.',
};

export default function SEPAMandatePage() {
  return <SEPAMandateSigning />;
}
