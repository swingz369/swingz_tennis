# F6.2 — PII-Mapping

Welche Tabellen/Spalten personenbezogene Daten enthalten und wie sie bei Anonymisierung behandelt werden.

| Tabelle                     | Spalte(n)                              | Art                    | Anonymisierung                       |
| --------------------------- | -------------------------------------- | ---------------------- | ------------------------------------ |
| `users`                     | `email`, `full_name`, `avatar_url`     | direkt identifizierend | `anonymizeUser()` → Pseudonym + NULL |
| `users`                     | `pseudonym`                            | nach Anonymisierung    | bleibt (GoBD §147 AO 10 Jahre)       |
| `user_club_memberships`     | `office_flags`, `notes`                | indirekt               | gelöscht bei Anonymisierung          |
| `audit_logs`                | `actor_id`, `ip_address`, `user_agent` | indirekt               | verbleiben (Compliance)              |
| `bookings`                  | `user_id`, `notes`                     | indirekt               | `user_id` → NULL, notes → NULL       |
| `newsletter_send_logs`      | `recipient_email`                      | direkt                 | verbleiben (Versandnachweis)         |
| `push_subscriptions`        | `endpoint`, `keys`                     | technisch              | gelöscht bei Anonymisierung          |
| `match_results` / `matches` | `player_left_ids`, `player_right_ids`  | indirekt               | user_id-Referenz bleibt (Stats)      |
| `elo_history`               | `user_id`                              | indirekt               | user_id-Referenz bleibt              |

## Rechtsgrundlage

- Speicherung: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
- Löschanfragen: Art. 17 DSGVO — via `AnonymizeService.anonymizeUser()`
- Aufbewahrung Rechnungen: § 147 AO (10 Jahre)

## Zugriffs-Audit

PII-Lesezugriffe werden via `logPiiRead()` in `lib/db/audit-logger.ts` protokolliert (action=`PII_READ`, 60s-Dedup).
