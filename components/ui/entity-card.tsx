import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { AvatarWithStatus } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, UserX, UserCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * EntityCard — Mobile-friendly entity card for members, trainers, etc.
 *
 * Uses TSOWAPP's group-hover pattern for elegant hover states.
 * Designed as an alternative to table rows on mobile.
 *
 * @example
 * <EntityCard
 *   name="Max Mustermann"
 *   email="max@example.com"
 *   role="member"
 *   isActive={true}
 *   actions={[{ icon: Eye, label: 'Details', href: '/admin/members/123' }]}
 * />
 */

interface EntityCardAction {
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
}

interface EntityCardProps {
  name: string;
  email?: string;
  subtitle?: string;
  role?: string;
  isActive?: boolean;
  /** Override the status badge — if not provided, uses isActive */
  statusLabel?: string;
  /** Status variant for StatusBadge */
  statusVariant?: string;
  avatarSrc?: string;
  actions?: EntityCardAction[];
  children?: ReactNode;
  className?: string;
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  admin: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400',
  trainer: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  superadmin: 'bg-info-100 text-info-700 dark:bg-info-900/30 dark:text-info-400',
  member: 'bg-muted text-foreground dark:bg-muted dark:text-foreground',
};

export function EntityCard({
  name,
  email,
  subtitle,
  role,
  isActive,
  statusLabel,
  statusVariant,
  avatarSrc,
  actions,
  children,
  className,
}: EntityCardProps) {
  const status = statusVariant ?? (isActive === false ? 'inactive' : 'active');
  const statusText = statusLabel ?? (isActive === false ? 'Inaktiv' : 'Aktiv');

  return (
    <Card
      className={cn(
        'group hover:shadow-md transition-all duration-200 border-border dark:border-white/10',
        className
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Top row: avatar + name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AvatarWithStatus
              src={avatarSrc}
              name={name}
              size="md"
              status={isActive === false ? 'offline' : 'online'}
              showStatus={false}
            />
            <div className="min-w-0">
              <p className="font-semibold text-foreground dark:text-white truncate text-sm">
                {name}
              </p>
              {email && (
                <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate">
                  {email}
                </p>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground dark:text-muted-foreground truncate mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={status} label={statusText} size="sm" />
        </div>

        {/* Role badge */}
        {role && (
          <Badge
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full border-0',
              ROLE_BADGE_CLASS[role] ?? ROLE_BADGE_CLASS.member
            )}
          >
            {role === 'admin'
              ? 'Admin'
              : role === 'trainer'
                ? 'Trainer'
                : role === 'superadmin'
                  ? 'Superadmin'
                  : 'Mitglied'}
          </Badge>
        )}

        {/* Extra content (e.g. phone, stats) */}
        {children}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-1 pt-2 border-t border-border dark:border-white/5">
            {actions.map((action, i) => {
              const Icon = action.icon;
              const cls = cn(
                'h-8 w-8 p-0',
                action.variant === 'destructive' &&
                  'text-error-500 hover:text-error-700 hover:bg-error-50 dark:hover:bg-error-900/20'
              );

              if (action.href) {
                return (
                  <Button key={i} variant="ghost" size="icon" className={cls} asChild>
                    <Link href={action.href} aria-label={action.label}>
                      <Icon className="h-4 w-4" />
                    </Link>
                  </Button>
                );
              }
              return (
                <Button
                  key={i}
                  variant="ghost"
                  size="icon"
                  className={cls}
                  onClick={action.onClick}
                  aria-label={action.label}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * MemberEntityCard — Pre-configured EntityCard for club members
 */
export function MemberEntityCard({
  name,
  email,
  phone,
  role,
  isActive,
  joinedAt,
  onView,
  onToggleActive,
}: {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  joinedAt?: string;
  onView?: () => void;
  onToggleActive?: () => void;
}) {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <EntityCard
      name={name}
      email={email}
      {...(joinedAt ? { subtitle: `Beigetreten: ${formatDate(joinedAt)}` } : {})}
      role={role}
      isActive={isActive}
      actions={[
        ...(onView ? [{ icon: Eye, label: 'Details', onClick: onView }] : []),
        ...(onToggleActive
          ? [
              {
                icon: isActive ? UserX : UserCheck,
                label: isActive ? 'Deaktivieren' : 'Aktivieren',
                onClick: onToggleActive,
                variant: (isActive ? 'destructive' : 'default') as 'destructive' | 'default',
              },
            ]
          : []),
      ]}
    >
      {phone && <p className="text-xs text-muted-foreground dark:text-muted-foreground">{phone}</p>}
    </EntityCard>
  );
}
