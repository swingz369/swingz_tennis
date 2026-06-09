'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer',
        className
      )}
    />
  );
}

// Card Skeleton – für Listen, Grids
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-[0_2px_8px_-2px_rgb(0,0,0,0.08),_0_4px_12px_-3px_rgb(0,0,0,0.06)]">
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-9 w-1/2" />
      </div>
    </div>
  );
}

// KPI Card Skeleton
export function KPISkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-soft">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-16" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="h-64 rounded-xl bg-muted p-4">
      <div className="flex h-full items-center justify-center">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-48 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}
