import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentSuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <CheckCircle className="h-16 w-16 text-success-500 mb-4" />
      <h1 className="text-2xl font-bold text-foreground mb-2">Zahlung erfolgreich!</h1>
      <p className="text-muted-foreground mb-6">Deine Buchung ist bestätigt.</p>
      <Button asChild>
        <Link href="/bookings">Zurück zu meinen Buchungen</Link>
      </Button>
    </div>
  );
}
