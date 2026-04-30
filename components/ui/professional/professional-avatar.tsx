import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProfessionalAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy';
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const statusSizeClasses = {
  xs: 'h-1.5 w-1.5',
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
};

const ProfessionalAvatar = React.forwardRef<HTMLDivElement, ProfessionalAvatarProps>(
  ({ className, src, name, size = 'md', showStatus = false, status = 'online', ...props }, ref) => {
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const statusColors = {
      online: 'bg-green-500',
      offline: 'bg-gray-400',
      busy: 'bg-red-500',
    };

    return (
      <div ref={ref} className={cn('relative inline-flex shrink-0', className)} {...props}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className={cn('rounded-full object-cover ring-2 ring-white', sizeClasses[size])}
          />
        ) : (
          <div
            className={cn(
              'rounded-full bg-gradient-to-br from-brandPrimary to-brandPrimary/80 flex items-center justify-center font-semibold text-white ring-2 ring-white',
              sizeClasses[size]
            )}
          >
            {initials}
          </div>
        )}
        {showStatus && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
              statusSizeClasses[size],
              statusColors[status]
            )}
          />
        )}
      </div>
    );
  }
);
ProfessionalAvatar.displayName = 'ProfessionalAvatar';

export { ProfessionalAvatar };
