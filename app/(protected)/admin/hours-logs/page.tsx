import { requireAdminClub } from '@/lib/admin-context';
import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default async function HoursLogsPage() {
  await requireAdminClub();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">Stundennachweise</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Verwalte die Arbeitsstunden deiner Trainer
        </p>
      </div>

      <Card className="p-12 gradient-border glass text-center">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-2xl bg-brandPrimary/10 mb-6">
          <Clock className="h-10 w-10 text-brandPrimary" />
        </div>
        <h3 className="text-2xl font-bold text-brand-primary">Stundennachweise in Arbeit</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
          Dieses Feature wird gerade entwickelt. Hier kannst du bald die gearbeiteten Stunden deiner
          Trainer einsehen, Stundennachweise erstellen und die Abrechnung verwalten.
        </p>
      </Card>
    </div>
  );
}
