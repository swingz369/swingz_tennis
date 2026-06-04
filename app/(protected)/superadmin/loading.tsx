'use client';

import { Loader2 } from 'lucide-react';

export default function SuperadminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-light" />
        <p className="text-sm text-muted-foreground">Superadmin wird geladen…</p>
      </div>
    </div>
  );
}
