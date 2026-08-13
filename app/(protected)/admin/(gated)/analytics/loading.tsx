import { KPISkeletonGrid, TableSkeleton } from '@/components/ui/loading-skeletons';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <KPISkeletonGrid />
      <TableSkeleton rows={4} />
    </div>
  );
}
