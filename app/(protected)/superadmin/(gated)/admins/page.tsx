import Link from 'next/link';
import { ChevronLeft, Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function Page() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/superadmin"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Zurück
        </Link>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Admins verwalten</h1>
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">In Entwicklung</p>
          <p className="text-sm text-muted-foreground">
            Verwalte Admins in deinen Vereinen und lade neue ein.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
