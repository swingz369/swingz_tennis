import { lazy, Suspense } from 'react';

export function withLazyLoading(
  importFn: () => Promise<{ default: React.ComponentType<any> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);

  return function LazyWrapper(props: any) {
    return (
      <Suspense fallback={fallback || <div className="animate-pulse bg-gray-200 rounded" />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function withCodeSplitting(componentPath: string) {
  return withLazyLoading(() => import(/* @vite-ignore */ componentPath));
}

export const LazyComponents = {
  Bookings: withLazyLoading(() => import('@/app/(protected)/bookings/page')),
  Scheduler: withLazyLoading(() => import('@/app/(protected)/scheduler/page')),
};
