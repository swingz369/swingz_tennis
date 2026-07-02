'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

export function DashboardTabs({ tabs, children }: { tabs: Tab[]; children: React.ReactNode[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex gap-1 px-5 pt-1">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActive(i)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              i === active
                ? 'bg-brand-light/10 text-brand-light'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span
                className={cn(
                  'ml-1.5 text-2xs font-bold px-1.5 py-0 rounded-full',
                  i === active
                    ? 'bg-brand-light/20 text-brand-light'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Active Tab Content */}
      <div>{children[active]}</div>
    </div>
  );
}
