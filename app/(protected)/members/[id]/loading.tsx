import { Card } from '@/components/ui/card';

export default function MemberProfileLoading() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
      </div>

      {/* KPI Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-8 w-16 bg-gray-300 rounded animate-pulse" />
              </div>
              <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </Card>
        ))}
      </div>

      {/* Details Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="bordered" className="p-6">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </Card>
        <Card variant="bordered" className="p-6">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
