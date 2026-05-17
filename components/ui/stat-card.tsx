import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string;
  iconClassName?: string;
  containerClassName?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}

export function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
  iconClassName,
  containerClassName,
  valueClassName,
  children,
}: StatCardProps) {
  return (
    <Card className={cn('border-0 shadow-sm p-0', containerClassName)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-xl shrink-0',
              'bg-brand-primary/10',
              iconClassName
            )}
          >
            {Icon && <Icon className={cn('h-5 w-5 text-brand-primary', valueClassName)} />}
          </div>
          <div>
            <p className={cn('text-2xl font-bold tabular-nums', valueClassName)}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
        {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
        {children && <div className="mt-2">{children}</div>}
      </CardContent>
    </Card>
  );
}
