'use client';

import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * DataTable — Reusable data table with client-side search, sorting, and pagination.
 *
 * Inspired by TSOWAPP's DataTable pattern. Wraps shadcn Table with
 * consistent search, sortable column headers, pagination, and empty states.
 *
 * @example
 * <DataTable
 *   columns={[
 *     { key: 'name', label: 'Name', sortable: true, searchable: true },
 *     { key: 'email', label: 'E-Mail', searchable: true },
 *     { key: 'role', label: 'Rolle' },
 *   ]}
 *   data={members}
 *   rowKey="id"
 *   hrefKey="id"
 *   hrefPrefix="/admin/members"
 *   emptyMessage="Keine Mitglieder gefunden"
 * />
 */

export interface DataTableColumn<T> {
  /** Unique key (matches a property on T) */
  key: keyof T & string;
  /** Column header label */
  label: string;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Whether this column is included in global search */
  searchable?: boolean;
  /** Custom render function for the cell */
  render?: (value: T[keyof T], row: T) => ReactNode;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
  /** Hide on small screens */
  hideOnMobile?: boolean;
  /** Column width class */
  width?: string;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Row data */
  data: T[];
  /** Unique key property for each row */
  rowKey: keyof T & string;
  /** If set, rows become links: `${hrefPrefix}/${row[hrefKey]}` */
  hrefKey?: keyof T & string;
  /** URL prefix for clickable rows */
  hrefPrefix?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Items per page options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Additional class on the table wrapper */
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  hrefKey,
  hrefPrefix,
  emptyMessage = 'Keine Einträge gefunden',
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 25,
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Searchable columns
  const searchableKeys = useMemo(
    () => columns.filter((c) => c.searchable).map((c) => c.key),
    [columns]
  );

  // Filtered data
  const filtered = useMemo(() => {
    if (!search || searchableKeys.length === 0) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchableKeys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchableKeys]);

  // Sorted data
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), 'de', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search + page size */}
      <div className="flex items-center gap-3">
        {searchableKeys.length > 0 && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suche..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
          <span className="hidden sm:inline">pro Seite:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800">
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wider',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.hideOnMobile && 'hidden lg:table-cell',
                      col.width,
                      col.sortable && 'cursor-pointer select-none hover:text-foreground'
                    )}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className="text-muted-foreground/60">
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState title={emptyMessage} size="sm" />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((row) => {
                  const rowContent = (
                    <TableRow
                      key={String(row[rowKey])}
                      className={cn(
                        'transition-colors',
                        hrefKey &&
                          hrefPrefix &&
                          'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5'
                      )}
                    >
                      {columns.map((col) => {
                        const value = row[col.key];
                        const content = col.render ? col.render(value, row) : String(value ?? '—');
                        return (
                          <TableCell
                            key={col.key}
                            className={cn(
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center',
                              col.hideOnMobile && 'hidden lg:table-cell'
                            )}
                          >
                            {content}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );

                  if (hrefKey && hrefPrefix) {
                    return (
                      <Link
                        key={String(row[rowKey])}
                        href={`${hrefPrefix}/${String(row[hrefKey])}`}
                        className="contents"
                      >
                        {rowContent}
                      </Link>
                    );
                  }
                  return rowContent;
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination footer */}
      {sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} von{' '}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </Button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
