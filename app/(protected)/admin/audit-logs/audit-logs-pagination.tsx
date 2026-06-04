'use client';

import { useSearchParams } from 'next/navigation';
import { PaginationNav } from '@/components/ui/pagination-nav';
import type { PaginationMeta } from '@/lib/pagination';

interface AuditLogsPaginationProps {
  pagination: PaginationMeta;
}

export function AuditLogsPagination({ pagination }: AuditLogsPaginationProps) {
  const searchParams = useSearchParams();

  const buildUrl = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    return `?${params.toString()}`;
  };

  return <PaginationNav meta={pagination} buildUrl={buildUrl} />;
}
