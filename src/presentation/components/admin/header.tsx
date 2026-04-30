// src/presentation/components/admin/header.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function Header() {
  const router = useRouter();

  return (
    <header className="h-16 border-b flex items-center justify-between px-6">
      <div className="text-sm text-muted-foreground">
        Tennisclub Management
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm">Admin User</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/')}
        >
          Zur Seite
        </Button>
      </div>
    </header>
  );
}
