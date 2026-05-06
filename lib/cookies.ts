/**
 * Canonical cookie name for the active admin club context.
 * ALL server and client code MUST use this constant — never hardcode the string.
 *
 * History: The codebase previously used both 'admin_club_id' and 'selected-club-id'
 * in different places, causing the superadmin club-switcher to silently fail.
 * Standardised to 'admin_club_id' (2026-05-07).
 */
export const ADMIN_CLUB_COOKIE = 'admin_club_id';

/** Max-age in seconds: 30 days */
export const ADMIN_CLUB_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
