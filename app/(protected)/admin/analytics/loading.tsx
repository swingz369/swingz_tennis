import { ProfessionalCard } from '@/components/ui/professional/professional-card';

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProfessionalCard key={i} variant="elevated" className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-24 bg-gray-300 rounded animate-pulse" />
              </div>
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </ProfessionalCard>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProfessionalCard key={i} variant="bordered" className="p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-64 bg-gray-50 rounded-lg border border-gray-100" />
          </ProfessionalCard>
        ))}
      </div>
    </div>
  );
}
