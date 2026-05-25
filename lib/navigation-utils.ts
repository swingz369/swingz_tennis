/**
 * Navigation utility helpers.
 *
 * Centralizes active-path detection so all nav components
 * (sidebar, bottom nav, navigation-category, admin-section)
 * use the same logic.
 */

/**
 * Checks whether `currentPath` is active for a given navigation `href`.
 *
 * Rules (in order):
 *  1. Exact match → active
 *  2. Prefix match → active EXCEPT for root-like pages where
 *     prefix-matching would be overbroad (e.g. /admin should not
 *     match /admin/something).
 *
 * @param currentPath - The current router pathname.
 * @param href         - The navigation target.
 * @param exactOnly    - If true, only exact matches are active.
 *                       Use for root/dashboard links.
 */
export function isActivePath(currentPath: string | null, href: string, exactOnly = false): boolean {
  if (!currentPath) return false;
  if (currentPath === href) return true;
  if (exactOnly) return false;

  // Prefix match – ensure we match a full segment, not a partial word.
  // e.g. href="/admin/members" should match "/admin/members/123"
  //      but href="/admin" should NOT match "/admin/members"
  // Normalize trailing slashes and only prefix-match hrefs with ≥ 2 segments
  const normalized = href.replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length <= 1) return false; // root-like pages: exact match only
  return currentPath.startsWith(normalized + '/');
}

/**
 * Shorthand: exact match only (for dashboard / home links).
 */
export function isExactActive(currentPath: string | null, href: string): boolean {
  return isActivePath(currentPath, href, true);
}
