/**
 * lib/pagination.ts — Server-Side Pagination Helper
 *
 * Provides a reusable pagination pattern for Supabase queries in Server Components.
 * Inspired by TSOWAPP's searchParams-based pagination.
 *
 * Usage in a page:
 *   const { page, offset, limit } = getPagination(searchParams);
 *   const { data, count } = await supabase
 *     .from('table')
 *     .select('*', { count: 'exact' })
 *     .range(offset, offset + limit - 1);
 *   const pagination = buildPaginationMeta(page, limit, count);
 */

export interface PaginationParams {
  /** Current page (1-based) */
  page: number;
  /** Offset for Supabase .range() */
  offset: number;
  /** Items per page */
  limit: number;
  /** Raw search query (if any) */
  search: string;
  /** All search params as URLSearchParams-compatible object */
  searchParams: Record<string, string | string[] | undefined>;
}

export interface PaginationMeta {
  /** Current page (1-based) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total items across all pages */
  totalCount: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
  /** Next page number (or null) */
  nextPage: number | null;
  /** Previous page number (or null) */
  prevPage: number | null;
  /** Offset for Supabase .range() */
  offset: number;
}

const DEFAULT_LIMIT = 25;

/** Sentinel "items per page" value for the "Alle" (show all) option. */
export const ALL_LIMIT = 100000;

/**
 * Extract pagination parameters from searchParams.
 *
 * @param searchParams - The searchParams object from Next.js page props
 * @param defaultLimit - Items per page if no `limit` param is present (default: 25)
 * @returns PaginationParams for use with Supabase queries
 */
export function getPagination(
  searchParams: Record<string, string | string[] | undefined>,
  defaultLimit: number = DEFAULT_LIMIT
): PaginationParams {
  const pageRaw = typeof searchParams.page === 'string' ? searchParams.page : '1';
  const page = Math.max(1, parseInt(pageRaw, 10) || 1);

  const limitRaw = typeof searchParams.limit === 'string' ? searchParams.limit : '';
  const limit =
    limitRaw === 'all' ? ALL_LIMIT : Math.max(1, parseInt(limitRaw, 10) || defaultLimit);

  const offset = (page - 1) * limit;
  const search = typeof searchParams.search === 'string' ? searchParams.search : '';

  return { page, offset, limit, search, searchParams };
}

/**
 * Build pagination metadata from query results.
 *
 * @param page - Current page (1-based)
 * @param limit - Items per page
 * @param totalCount - Total count from Supabase { count: 'exact' }
 * @returns PaginationMeta for rendering pagination UI
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  totalCount: number | null
): PaginationMeta {
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    page,
    limit,
    totalCount: total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    nextPage: page < totalPages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null,
    offset: (page - 1) * limit,
  };
}

/**
 * Build a query string with updated page number, preserving other params.
 *
 * @param currentParams - Current search params
 * @param page - Target page number
 * @returns Query string (without leading ?)
 */
export function buildPageUrl(
  currentParams: Record<string, string | string[] | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(currentParams)) {
    if (key === 'page') continue;
    if (typeof value === 'string') {
      params.set(key, value);
    }
  }
  params.set('page', String(page));
  return params.toString();
}
