import { Card } from '@/components/ui/card';

export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </div>

      <Card variant="bordered">
        <div className="p-6">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 rounded-xl bg-muted dark:bg-card/5"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
