'use client';

import { ThemeToggle } from '@/components/ui/theme-toggle';

export function ThemeToggleWrapper() {
  return (
    <div className="flex justify-end mb-2">
      <ThemeToggle className="h-9 w-9 rounded-full" />
    </div>
  );
}
