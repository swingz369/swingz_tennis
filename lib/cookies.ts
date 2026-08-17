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

/**
 * Canonical cookie name for the surface mode of users with a double role
 * (admin = „Verwalten" ↔ „Spielen"). Server and client code MUST use this
 * constant — never hardcode the string.
 *
 * The mode is a pure UI preference, NOT a security boundary: it only decides
 * which surface (admin console vs. member surface) is rendered and whether the
 * server-side member layout redirects a club admin back to /admin. It never
 * grants access — authorization stays on the real `user_club_memberships` row.
 *
 * Cookie instead of localStorage: the server-side guards (member layout) need
 * to see the mode too, and a cookie is sent with every request. Values: 'admin'
 * (default) or 'member'. Absent cookie = admin mode.
 */
export const ROLE_MODE_COOKIE = 'swingz_role_mode';

/** Max-age in seconds: 1 year — the preference should survive logins. */
export const ROLE_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
