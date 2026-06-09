# Clustering API — Endpunkt-Dokumentation

> **Quelle:** `app/api/seasons/[id]/planning/cluster/route.ts`
> **Engine:** `lib/season-planning/clustering-engine.ts`
> **Typen:** `lib/season-planning/types.ts` (`RunClusteringRequest`)

---

## Endpunkt

| Eigenschaft        | Wert                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Methode**        | `POST`                                                                                             |
| **Pfad**           | `/api/seasons/[id]/planning/cluster`                                                               |
| **Pfad-Parameter** | `id` — UUID der Saison                                                                             |
| **Auth**           | `withApiAuth(request, async (auth) => { … })` — Session-Cookie, ADMIN oder SUPERADMIN erforderlich |
| **Club-Scope**     | Admin muss `club_id` der Saison in seinen Memberships haben (Superadmin umgeht)                    |
| **Rate-Limit**     | 50 Requests / Stunde (per IP+Session)                                                              |
| **Datei-Größe**    | kein Limit (Body < 1 MB)                                                                           |

---

## Auth-Header

Der Endpunkt nutzt **Supabase-Session-Cookies** (kein Bearer-Token nötig). Login via `POST /api/auth/login` setzt die `sb-…`-Cookies. `withApiAuth` extrahiert daraus `auth.user.id` und `auth.memberships[]`.

**Beispiel mit `page.request` (Playwright/Midscene):**

```typescript
await page.request.post(`${BASE_URL}/api/seasons/${seasonId}/planning/cluster`, {
  data: { config: { backtrackDepth: 3 }, dryRun: true },
  // Cookies werden automatisch mitgesendet (page.request = authenticated context)
});
```

---

## Body-Schema (Request)

```typescript
interface RunClusteringRequest {
  seasonId: string; // (redundant — auch in der URL)
  config?: Partial<{
    // Groupe-Planung
    maxNiveauSpanBeginner: number; // default 4  (Monate)
    maxNiveauSpanAdvanced: number; // default 8  (Monate)
    groupMaxSize: number; // default 12
    groupMinSize: number; // default 3
    kidsGroupMaxSize: number; // default 6
    kidsGroupMinSize: number; // default 3
    slotDurationMinutes: number; // default 90

    // Trainer
    trainerUtilizationMaxPct: number; // default 80

    // Slot-Quality
    provenGroupThreshold: number; // default 80 (%)
    slotFailureThreshold: number; // default 30 (%)
    preferHistoricGroups: boolean; // default true
    avoidHighFailureSlots: boolean; // default true
  }>;
  dryRun?: boolean; // default true (true = kein DB-Write)
}
```

**Beispiel:**

```json
{
  "config": {
    "groupMaxSize": 12,
    "groupMinSize": 3,
    "trainerUtilizationMaxPct": 80,
    "slotDurationMinutes": 90,
    "treatHighFailureAsHard": false,
    "backtrackDepth": 3
  },
  "dryRun": true
}
```

> **Hinweis:** `treatHighFailureAsHard` und `backtrackDepth` werden **nicht** im Request-Body-Schema aufgeführt, aber **vom Engine-Konstruktor** akzeptiert (siehe `ClusteringConfig` in `clustering-engine.ts:48-78`). Wichtig: Wenn ein `seasonPlanningConfigs`-Row in der DB existiert, **überschreibt dieser die Konstruktor-Config** (`loadConfig()` in `clustering-engine.ts:240-280`).

---

## Response-Schema (200 OK)

```typescript
interface RunClusteringResponse {
  success: true;
  seasonId: string;
  dryRun: boolean;
  result: {
    groups: Array<{
      groupId: string;
      groupName: string;
      trainerId: string;
      trainerName: string;
      dayOfWeek: number; // 0=So, 1=Mo, ..., 6=Sa (DAY_NAMES[dayOfWeek])
      startTime: string; // "HH:MM"
      endTime: string; // "HH:MM"
      courtId: string | null;
      courtName: string | null;
      memberCount: number;
      memberDetails: Array<{
        memberId: string;
        memberName: string;
        niveauMatch: number; // 0-100
        experienceMonths: number;
        groupExperienceSpan: string;
        wishPartnerFulfilled: boolean;
        wishPartnerNames: string[];
        isPromoted: boolean;
        assignmentReason: string;
      }>;
      waitlistCount: number;
      warnings: string[];
    }>;
    unassignedMembers: Array<{
      memberId: string;
      memberName: string;
      reason: string;
    }>;
    waitlistSummary: Array<{
      memberId: string;
      memberName: string;
      groupName: string;
      position: number;
      alternativeGroupName: string | null;
    }>;
    metrics: {
      totalMembers: number;
      totalGroups: number;
      totalTrainers: number;
      avgNiveauMatch: number;
      niveauSpanViolations: number;
      wishPartnerRequests: number;
      wishPartnerFulfilled: number;
      wishPartnerRate: number; // 0-100
      avgTrainerUtilization: number;
      trainerOverloadWarnings: number;
      highRiskSlotsUsed: number;
      totalWaitlisted: number;
      runtimeMs: number;
      iterations: number;
    };
    explanations: string[]; // Human-readable bullets
  };
}
```

**Beispiel:**

```json
{
  "success": true,
  "seasonId": "s1-abc-123",
  "dryRun": true,
  "result": {
    "groups": [
      {
        "groupId": "g1-xyz-789",
        "groupName": "Intermediate Gruppe 1",
        "trainerId": "t1",
        "trainerName": "Martin Berger",
        "dayOfWeek": 1,
        "startTime": "18:00",
        "endTime": "19:30",
        "courtId": "c1",
        "courtName": "Center Court",
        "memberCount": 8,
        "memberDetails": [
          /* ... */
        ],
        "waitlistCount": 0,
        "warnings": []
      }
    ],
    "unassignedMembers": [],
    "waitlistSummary": [],
    "metrics": {
      "totalMembers": 200,
      "totalGroups": 22,
      "totalTrainers": 8,
      "avgNiveauMatch": 87.5,
      "niveauSpanViolations": 0,
      "wishPartnerRequests": 47,
      "wishPartnerFulfilled": 42,
      "wishPartnerRate": 89.36,
      "avgTrainerUtilization": 73.2,
      "trainerOverloadWarnings": 0,
      "highRiskSlotsUsed": 0,
      "totalWaitlisted": 3,
      "runtimeMs": 142,
      "iterations": 22
    },
    "explanations": [
      "Clustering abgeschlossen: 22 Gruppen mit 200 Mitgliedern",
      "Trainer Martin Berger: 3 Sessions (4.5h von max 24h)",
      "Keine Hinweise — alle Constraints erfüllt."
    ]
  }
}
```

---

## Error-Responses

| Status  | Code                           | Bedeutung                                         |
| ------- | ------------------------------ | ------------------------------------------------- |
| **400** | `Bad Request`                  | Body ist kein valides JSON                        |
| **401** | `Unauthorized`                 | Keine Session / keine Auth-Cookies                |
| **403** | `Nur Admins`                   | User ist weder `admin` noch `superadmin`          |
| **403** | `Kein Zugriff auf diesen Club` | Admin ist nicht in der Club-Membership der Saison |
| **404** | `Season not found`             | Saison-ID existiert nicht                         |
| **429** | `Too Many Requests`            | Rate-Limit (50/h) überschritten                   |
| **500** | `Clustering failed`            | DB-Fehler oder Algorithmus-Exception              |

---

## Voraussetzungen (Daten-Seite)

Damit der Clustering-Algorithmus sinnvolle Ergebnisse liefert, müssen folgende DB-Tabellen befüllt sein:

1. **`users`** (200 Mitglieder + 8 Trainer + 1 Admin)
2. **`user_club_memberships`** (alle mit `club_id` der Saison + `is_active=true`)
3. **`user_training_preferences`** (je User, `season_id` = Ziel-Saison, `is_submitted=true`, `user_role='member'` oder `'trainer'`)
4. **`trainers`** + **`trainer_club`** (für die 8 Trainer)
5. **`courts`** (5 Plätze mit `club_id` + `is_active=true`)
6. **`season_planning_configs`** (optional — wenn vorhanden, überschreibt Constructor-Config)
7. **`seasons`** (1 Eintrag mit `id` = URL-Parameter)

Siehe `scripts/seed-perf-test.ts` für ein vollständiges Seed-Skript.

---

## Performance-Erwartungen (Stand Sprint 3)

| Datensatz                                | Engine-Laufzeit | API-Roundtrip |
| ---------------------------------------- | --------------- | ------------- |
| 20 Mitglieder / 2 Trainer / 4 Plätze     | ~50 ms          | ~150 ms       |
| 200 Mitglieder / 8 Trainer / 5 Plätze    | ~150 ms         | ~250 ms       |
| 500 Mitglieder / 12 Trainer / 8 Plätze   | ~400 ms         | ~550 ms       |
| 1000 Mitglieder / 20 Trainer / 12 Plätze | ~1200 ms        | ~1500 ms      |

_Gemessen mit M2 MacBook Air, lokaler Postgres, ohne Backtracking. Mit Backtracking (depth=3): +30–50 %._

---

## Verwandte Endpoints

| Endpoint                                     | Zweck                                             |
| -------------------------------------------- | ------------------------------------------------- |
| `GET /api/seasons/[id]/planning/conflicts`   | Erkannte Konflikte laden                          |
| `POST /api/seasons/[id]/planning/conflicts`  | Konflikte neu erkennen                            |
| `PATCH /api/seasons/[id]/planning/conflicts` | Konflikt resolve/ignore                           |
| `GET /api/seasons/[id]/planning/config`      | Aktuelle `seasonPlanningConfigs` laden            |
| `PUT /api/seasons/[id]/planning/config`      | `seasonPlanningConfigs` aktualisieren (Whitelist) |
| `PUT /api/seasons/[id]/config`               | Kurz-Form (gleicher Zweck)                        |
| `POST /api/seasons/[id]/planning/confirm`    | Plan bestätigen + veröffentlichen                 |
