'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { ALL_LIMIT, type PaginationMeta } from '@/lib/pagination';

interface PaginationNavProps {
  /** Pagination metadata from `buildPaginationMeta()`. */
  meta: PaginationMeta;
  /**
   * Build a URL for a given page number. Enables **Link-based navigation**
   * (SSR-friendly, uses `<Link>` under the hood).
   * Mutually exclusive with `onPageChange` — provide one or the other.
   *
   * @example
   * buildUrl={(p) => `?page=${p}&search=foo`}
   */
  buildUrl?: (page: number) => string;
  /**
   * Callback for page change. Enables **onClick-based navigation**
   * (client-side, uses `setState` or `router.push`).
   * Mutually exclusive with `buildUrl` — provide one or the other.
   *
   * @example
   * onPageChange={(p) => setPage(p)}
   * onPageChange={(p) => router.push(`/admin/items?page=${p}`)}
   */
  onPageChange?: (page: number) => void;
  /** Show a page-size selector dropdown (e.g. `[10, 25, 50, 'all']`). */
  pageSizeOptions?: (number | 'all')[];
  /** Current page size value (required when using `pageSizeOptions`). */
  currentLimit?: number;
  /** Called when user selects a new page size (resolved to `ALL_LIMIT` for `'all'`). */
  onPageSizeChange?: (size: number) => void;
  /** Compact mode: hides first/last buttons and page numbers, shows only `page / total`. */
  compact?: boolean;
  /** Additional CSS classes on the outer `<nav>`. */
  className?: string;
}

/**
 * Reusable pagination navigation component.
 *
 * Supports two navigation modes:
 * - **Link-based** (`buildUrl`): SSR-friendly, renders `<a>` tags for each page.
 *   Use in Server Components or when search-params drive pagination.
 * - **onClick-based** (`onPageChange`): Client-side, calls a callback on click.
 *   Use with `useState` or `router.push`.
 *
 * @example
 * // Link-based (server-rendered pages)
 * <PaginationNav
 *   meta={pagination}
 *   buildUrl={(p) => `?${buildPageUrl(params, p)}`}
 * />
 *
 * @example
 * // onClick-based (client-side state)
 * <PaginationNav
 *   meta={pagination}
 *   compact
 *   onPageChange={setPage}
 * />
 *
 * @example
 * // With page-size selector
 * <PaginationNav
 *   meta={pagination}
 *   buildUrl={buildUrl}
 *   pageSizeOptions={[10, 25, 50, 'all']}
 *   currentLimit={limit}
 *   onPageSizeChange={(size) => router.push(`?page=1&limit=${size}`)}
 * />
 */
export function PaginationNav({
  meta,
  buildUrl,
  onPageChange,
  pageSizeOptions,
  currentLimit,
  onPageSizeChange,
  compact = false,
  className = '',
}: PaginationNavProps) {
  if (meta.totalPages <= 1 && !pageSizeOptions) return null;

  const { page, totalPages, totalCount, hasNext, hasPrev, nextPage, prevPage, limit } = meta;

  // Build visible page range (show max 7 pages with ellipsis)
  const visiblePages = getVisiblePages(page, totalPages);

  /** Render a pagination button — uses Link when buildUrl is provided, onClick otherwise */
  const renderBtn = (
    key: string | number,
    targetPage: number,
    enabled: boolean,
    icon: ReactNode,
    label: string,
    variant: 'default' | 'outline' = 'outline',
    showNum?: number
  ) => {
    const isActive = showNum !== undefined && showNum === page;
    const btnVariant = isActive ? 'default' : variant;

    if (onPageChange) {
      return (
        <Button
          key={key}
          variant={btnVariant}
          size="icon"
          className="h-8 w-8 text-xs"
          disabled={!enabled}
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onPageChange(targetPage)}
        >
          {showNum !== undefined ? showNum : icon}
        </Button>
      );
    }

    if (enabled && buildUrl) {
      return (
        <Button
          key={key}
          variant={btnVariant}
          size="icon"
          className="h-8 w-8 text-xs"
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          asChild
        >
          <Link href={buildUrl(targetPage)} prefetch={false}>
            {showNum !== undefined ? showNum : icon}
          </Link>
        </Button>
      );
    }

    return (
      <Button
        key={key}
        variant={btnVariant}
        size="icon"
        className="h-8 w-8 text-xs"
        disabled
        aria-label={label}
      >
        {showNum !== undefined ? showNum : icon}
      </Button>
    );
  };

  return (
    <nav
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
      aria-label="Seitennavigation"
    >
      {/* Left: Info + optional page-size */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {totalCount > 0
            ? `${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} von ${totalCount}`
            : '0 Einträge'}
        </span>
        {pageSizeOptions && onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs">pro Seite:</span>
            <Select
              value={String(currentLimit ?? limit)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="w-[70px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => {
                  const value = size === 'all' ? ALL_LIMIT : size;
                  return (
                    <SelectItem key={String(size)} value={String(value)}>
                      {size === 'all' ? 'Alle' : size}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right: Page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        {!compact &&
          renderBtn('first', 1, hasPrev, <ChevronsLeft className="h-4 w-4" />, 'Erste Seite')}

        {/* Previous */}
        {renderBtn(
          'prev',
          prevPage ?? 1,
          hasPrev,
          <ChevronLeft className="h-4 w-4" />,
          'Vorherige Seite'
        )}

        {/* Page numbers */}
        {!compact &&
          visiblePages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-muted-foreground text-sm">
                …
              </span>
            ) : (
              renderBtn(p, p, p !== page, null, `Seite ${p}`, 'outline', p)
            )
          )}

        {/* Current page indicator in compact mode */}
        {compact && (
          <span className="px-3 text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
        )}

        {/* Next */}
        {renderBtn(
          'next',
          nextPage ?? totalPages,
          hasNext,
          <ChevronRight className="h-4 w-4" />,
          'Nächste Seite'
        )}

        {/* Last page */}
        {!compact &&
          renderBtn(
            'last',
            totalPages,
            hasNext,
            <ChevronsRight className="h-4 w-4" />,
            'Letzte Seite'
          )}
      </div>
    </nav>
  );
}

/** Calculate which page numbers to show (max 7 entries with ellipsis) */
function getVisiblePages(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) {
    pages.push('...');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  pages.push(total);

  return pages;
}
