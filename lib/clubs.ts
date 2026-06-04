import type { PaginationMeta } from '@/lib/pagination';

/** Minimal club representation returned by GET /api/clubs */
export interface Club {
  id: string;
  name: string;
  maxMembers: number;
  status: string;
  memberCount: number;
}

/** Response shape from GET /api/clubs with pagination */
export interface ClubsResponse {
  clubs: Club[];
  pagination: PaginationMeta;
}

/**
 * Parse the JSON response from GET /api/clubs.
 *
 * Handles both the new paginated shape `{ clubs, pagination }` and the legacy
 * flat-array response, so consumers don't need to duplicate this logic.
 *
 * @param data - The raw JSON returned by `res.json()`
 * @returns The clubs array (never null)
 */
export function parseClubsResponse(data: unknown): Club[] {
  if (
    data !== null &&
    typeof data === 'object' &&
    'clubs' in data &&
    Array.isArray((data as ClubsResponse).clubs)
  ) {
    return (data as ClubsResponse).clubs;
  }
  // Backward-compat: API used to return a flat array
  return Array.isArray(data) ? data : [];
}
