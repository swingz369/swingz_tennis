# Superadmin — Tennisschulen-Chef

> Wer bist du? Du bist Chef:in einer Tennisschule, die mehrere Vereine betreut. Du verwaltest eine **Schule-Gruppe** und kannst für jeden deiner Vereine in dessen Rolle wechseln.

**Dashboard:** `/superadmin` · **Rolle in Hierarchie:** Stufe 4 · **club_id:** `NULL` (mehrere Vereine via Membership)

---

## 🎯 Was kannst du?

- **Siehst alle deiner Tennisschule zugeordneten Vereine** (über `user_club_memberships.club_id` gefiltert)
- **Wechselst zwischen Vereinen** via Club-Switcher (Cookie-basiert)
- **Kann Admin-Aktionen** in jedem deiner Vereine ausführen
- **Plan-Management** für die Schulen-Gruppe
- **Schulen-übergreifende Reports** (z. B. gesamt-Umsatz aller deiner Vereine)
- **Wissen über andere Tennisschulen:** NICHT. Du siehst nur deine eigenen Vereine.

## 🖥 Dashboard-Walkthrough (`/superadmin`)

Oben:

| Sektion                                   | Was zeigt sie?                                                |
| ----------------------------------------- | ------------------------------------------------------------- |
| **Schulen-KPI**                           | Aggregat über alle deiner Tennisschule zugeordnete Vereine    |
| **Club-Switcher** (links oben)            | Drop-Down: aktiver Verein. Wechsel setzt `ADMIN_CLUB_COOKIE`. |
| **Recent Activity (vereinsübergreifend)** | Letzte 20 Aktionen in all deinen Clubs                        |

## 🧭 Pages (Superadmin-Bereich)

| Pfad                           | Zweck                                                   |
| ------------------------------ | ------------------------------------------------------- |
| `/superadmin`                  | Dashboard                                               |
| `/superadmin/clubs`            | Liste aller **deiner** Vereine                          |
| `/superadmin/clubs/[id]`       | Vereins-Detail (für dich als Superadmin dieses Vereins) |
| `/superadmin/billing-overview` | Sammel-Rechnung aller deiner Vereine                    |
| `/superadmin/subscription`     | Plan-Verwaltung schulen-weit                            |

## ⚙ Häufige Aktionen

### 1. Verein wechseln (Club-Switcher)

UI: Header-Bar → Drop-Down "Aktiver Verein" → Verein auswählen.

Unter der Haube:

```
1. POST /api/admin/clubs/switch { club_id }
2. response.cookies.set(ADMIN_CLUB_COOKIE, clubId)
3. Browser-Reload: requireAdminClub() liest Cookie → role = 'admin' für diesen Verein
```

Sicherheit: `verifyClubAccess(auth, clubId)` in API-Routes lässt dich nur in deinen eigenen Vereinen rein. Versuchst du `ADMIN_CLUB_COOKIE` auf einen fremden Verein zu setzen → 403.

### 2. Schulen-Abrechnung erstellen

UI: `/superadmin/billing-overview` → "Rechnungen für alle Vereine generieren".

```
Pro Verein:
  POST /api/billing/invoices/generate { club_id, period: 'YYYY-MM' }
Aggregiert in: superadmin_reports.school_invoice_overview
```

### 3. Trainer zwischen Vereinen verschieben

⚠️ **Aktuell nicht direkt UI-supported**. Workaround:

1. Im alten Verein: Trainer-Membership `is_active=false`
2. Im neuen Verein: Trainer-Membership neu erstellen (User-Account bleibt gleich)

## 🤝 Zusammenspiel mit anderen Rollen

| Edge-Case                                               | Was passiert?                                         | Wie handelst du?                                 |
| ------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Admin in Verein A will anderen Verein sehen             | Sollte andere Rolle haben                             | Hinweis: "Nur dein eigener Verein sichtbar"      |
| Owner erstellt neuen Verein für dich                    | Owner lädt dich ein (User-Reuse wenn schon auth-User) | Du bekommst neue Membership-Zeile                |
| Trainer verlässt beide deiner Vereine                   | Beide Memberships auf inactive                        | "Re-Activate"-Button im Club-Switcher-Menü       |
| Plan-Wechsel eines Vereins wirkt sich schulen-weit aus? | **NICHT** — Plan ist pro Verein                       | Du musst pro Verein separat upgraden             |
| Stripe-Subscription teilen sich?                        | **NICHT** — pro Verein eigene Stripe-Customer         | Manager-Tools via `/superadmin/billing-overview` |

## 🆚 Superadmin vs. Admin

| Aktion                        |                  Admin                  |       Superadmin        |
| ----------------------------- | :-------------------------------------: | :---------------------: |
| Sieht Vereins-Daten           |                 eigener                 |    mehrere (eigene)     |
| Club-Switcher                 | nur über ADMIN_CLUB_COOKIE wenn mehrere |        jederzeit        |
| Plan verwalten                |             eigener Verein              | mehrere Vereine einzeln |
| Trainer einladen              |                   ✅                    |           ✅            |
| Audit-Log                     |           nur eigener Verein            |  alle eigenen Vereine   |
| Hardware-Add-On (Smart Court) |            ✅ eigener Verein            |    ✅ eigener Verein    |

## ⚠️ Pflichten & Risiken

1. **Trainer-Longrun**: Trainer in **mehreren deiner Vereinen** bedeuten Mehrfach-Membership. Vergewissere dich beim Onboarding.
2. **Plan-Änderungen pro Verein**: Du verwaltest Plan **pro Verein**, nicht pro Schule. Wenn ein Verein upgradet, der andere nicht, ist das eure Entscheidung.
3. **Audit-Trail**: Jeder Cross-Club-Zugriff wird im Audit-Log mit `actor_id` und ggf. `selected_club_id` markiert.

## 📚 Verwante Kapitel

- [`../user/owner.md`](./owner.md) — Plattformbetreiber
- [`../user/admin.md`](./admin.md) — Vereins-Admin (deine Rolle für jeweils einen Verein)
- [`dev/auth-rbac.md`](../dev/auth-rbac.md) — wie die Rollen-Hierarchie technisch umgesetzt ist
