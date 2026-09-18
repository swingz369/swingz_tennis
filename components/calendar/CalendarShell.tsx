'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface CalendarShellNav {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Shared chrome for all calendar views — consistent glass-nav header. */
export function CalendarShell({
  title,
  subtitle,
  nav,
  controls,
  children,
}: {
  title: string;
  subtitle?: string;
  nav?: CalendarShellNav;
  controls?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {(nav || controls) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/60 shadow-sm px-3 py-2">
          {controls}
          {nav && (
            <>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={nav.onToday}
                className="text-xs font-semibold text-primary hover:text-primary/80"
              >
                Heute
              </Button>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={nav.onPrev}
                      aria-label="Zurück"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zurück</TooltipContent>
                </Tooltip>
                <span className="min-w-[140px] text-center text-sm font-semibold text-foreground tabular-nums">
                  {nav.label}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-xl"
                      onClick={nav.onNext}
                      aria-label="Vor"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vor</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
