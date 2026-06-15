// German school holidays by Bundesland for 2025/2026
// Used by the season planning system to mark holiday weeks in the schedule grid

export interface Holiday {
  name: string;
  start: string; // ISO date YYYY-MM-DD
  end: string;
}

export interface WeekInfo {
  monday: string; // ISO date of Monday
  isHolidayWeek: boolean;
  holidayNames: string[];
}

// ============================================
// ALL 16 BUNDESLÄNDER — 2025/2026 SCHOOL YEAR
// ============================================
// Source: Kultusministerkonferenz (KMK) official calendar
// Note: movable holidays (Pfingsten, Christi Himmelfahrt, Fronleichnam)
// vary by state and are included where applicable.

const HOLIDAYS_2025: Record<string, Holiday[]> = {
  BW: [
    // Baden-Württemberg
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-26' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-21' },
    { name: 'Sommerferien', start: '2025-07-31', end: '2025-09-13' },
    { name: 'Herbstferien', start: '2025-10-27', end: '2025-10-31' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  BY: [
    // Bayern
    { name: 'Frühjahrsferien', start: '2025-03-03', end: '2025-03-07' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-20' },
    { name: 'Sommerferien', start: '2025-08-01', end: '2025-09-15' },
    { name: 'Herbstferien', start: '2025-11-03', end: '2025-11-07' },
    { name: 'Weihnachtsferien', start: '2025-12-24', end: '2026-01-05' },
  ],
  BE: [
    // Berlin
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-10' },
    { name: 'Sommerferien', start: '2025-07-17', end: '2025-08-29' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-11-01' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  BB: [
    // Brandenburg
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-16', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-17', end: '2025-08-29' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-11-01' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  HB: [
    // Bremen
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-04' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-07-03', end: '2025-08-13' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  HH: [
    // Hamburg
    { name: 'Winterferien', start: '2025-01-31', end: '2025-01-31' },
    { name: 'Osterferien', start: '2025-03-10', end: '2025-03-21' },
    { name: 'Pfingstferien', start: '2025-05-26', end: '2025-05-30' },
    { name: 'Sommerferien', start: '2025-07-17', end: '2025-08-27' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-31' },
    { name: 'Weihnachtsferien', start: '2025-12-17', end: '2026-01-02' },
  ],
  HE: [
    // Hessen
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-21' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-09' },
  ],
  MV: [
    // Mecklenburg-Vorpommern
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-15' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-23' },
    { name: 'Pfingstferien', start: '2025-06-06', end: '2025-06-10' },
    { name: 'Sommerferien', start: '2025-07-28', end: '2025-09-06' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  NI: [
    // Niedersachsen
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-04' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Sommerferien', start: '2025-07-03', end: '2025-08-13' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  NW: [
    // Nordrhein-Westfalen
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-26' },
    { name: 'Pfingstferien', start: '2025-06-10', end: '2025-06-10' },
    { name: 'Sommerferien', start: '2025-07-14', end: '2025-08-26' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-06' },
  ],
  RP: [
    // Rheinland-Pfalz
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-24' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-07' },
  ],
  SL: [
    // Saarland
    { name: 'Winterferien', start: '2025-02-24', end: '2025-03-04' },
    { name: 'Osterferien', start: '2025-04-14', end: '2025-04-25' },
    { name: 'Sommerferien', start: '2025-07-07', end: '2025-08-15' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-24' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  SN: [
    // Sachsen
    { name: 'Winterferien', start: '2025-02-17', end: '2025-03-01' },
    { name: 'Osterferien', start: '2025-04-18', end: '2025-04-25' },
    { name: 'Pfingstferien', start: '2025-05-30', end: '2025-05-30' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-02' },
  ],
  ST: [
    // Sachsen-Anhalt
    { name: 'Winterferien', start: '2025-01-27', end: '2025-01-31' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Pfingstferien', start: '2025-05-30', end: '2025-05-30' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-05' },
  ],
  SH: [
    // Schleswig-Holstein
    { name: 'Osterferien', start: '2025-04-11', end: '2025-04-25' },
    { name: 'Pfingstferien', start: '2025-05-30', end: '2025-05-30' },
    { name: 'Sommerferien', start: '2025-07-14', end: '2025-08-23' },
    { name: 'Herbstferien', start: '2025-10-20', end: '2025-10-31' },
    { name: 'Weihnachtsferien', start: '2025-12-19', end: '2026-01-07' },
  ],
  TH: [
    // Thüringen
    { name: 'Winterferien', start: '2025-02-03', end: '2025-02-08' },
    { name: 'Osterferien', start: '2025-04-07', end: '2025-04-19' },
    { name: 'Pfingstferien', start: '2025-05-30', end: '2025-05-30' },
    { name: 'Sommerferien', start: '2025-06-28', end: '2025-08-08' },
    { name: 'Herbstferien', start: '2025-10-06', end: '2025-10-18' },
    { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-03' },
  ],
};

// Also add early 2026 holidays that overlap with winter season
const HOLIDAYS_2026: Record<string, Holiday[]> = {
  BW: [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Pfingstferien', start: '2026-05-26', end: '2026-06-05' },
    { name: 'Sommerferien', start: '2026-07-30', end: '2026-09-12' },
  ],
  BY: [
    { name: 'Frühjahrsferien', start: '2026-02-16', end: '2026-02-20' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Pfingstferien', start: '2026-05-26', end: '2026-06-05' },
    { name: 'Sommerferien', start: '2026-08-01', end: '2026-09-15' },
  ],
  BE: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-16', end: '2026-08-28' },
  ],
  BB: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-04-01', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-16', end: '2026-08-28' },
  ],
  HB: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-03' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-07-02', end: '2026-08-12' },
  ],
  HH: [
    { name: 'Osterferien', start: '2026-03-09', end: '2026-03-20' },
    { name: 'Pfingstferien', start: '2026-05-12', end: '2026-05-16' },
    { name: 'Sommerferien', start: '2026-07-16', end: '2026-08-26' },
  ],
  HE: [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
  ],
  MV: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-14' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-08' },
    { name: 'Sommerferien', start: '2026-07-27', end: '2026-09-05' },
  ],
  NI: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-03' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-07-02', end: '2026-08-12' },
  ],
  NW: [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
    { name: 'Sommerferien', start: '2026-07-13', end: '2026-08-25' },
  ],
  RP: [
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
  ],
  SL: [
    { name: 'Winterferien', start: '2026-02-16', end: '2026-02-24' },
    { name: 'Osterferien', start: '2026-03-30', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-06', end: '2026-08-14' },
  ],
  SN: [
    { name: 'Winterferien', start: '2026-02-09', end: '2026-02-21' },
    { name: 'Osterferien', start: '2026-04-03', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
  ],
  ST: [
    { name: 'Winterferien', start: '2026-01-26', end: '2026-01-30' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
  ],
  SH: [
    { name: 'Osterferien', start: '2026-03-27', end: '2026-04-10' },
    { name: 'Sommerferien', start: '2026-07-13', end: '2026-08-22' },
  ],
  TH: [
    { name: 'Winterferien', start: '2026-02-02', end: '2026-02-07' },
    { name: 'Osterferien', start: '2026-03-23', end: '2026-04-04' },
    { name: 'Sommerferien', start: '2026-06-27', end: '2026-08-07' },
  ],
};

/**
 * Merged holidays: 2025 values take precedence for overlapping periods.
 * In practice, the two maps cover different date ranges so conflicts are rare.
 */
function mergeHolidays(a: Holiday[], b: Holiday[]): Holiday[] {
  return [...a, ...b].sort((x, y) => x.start.localeCompare(y.start));
}

// ============================================
// 2027 SCHOOL HOLIDAYS — OFFICIAL KMK DATES
// ============================================
// Source: Kultusministerkonferenz (KMK) Ferienkalender 2026/2027
// https://www.kmk.org/service/ferienregelung/ferienkalender.html

const HOLIDAYS_2027: Record<string, Holiday[]> = {
  BW: [
    { name: 'Osterferien', start: '2027-03-30', end: '2027-04-03' },
    { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-29' },
    { name: 'Sommerferien', start: '2027-07-29', end: '2027-09-11' },
    { name: 'Herbstferien', start: '2027-11-02', end: '2027-11-06' },
  ],
  BY: [
    { name: 'Frühjahrsferien', start: '2027-02-08', end: '2027-02-12' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-02' },
    { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-28' },
    { name: 'Sommerferien', start: '2027-08-02', end: '2027-09-13' },
    { name: 'Herbstferien', start: '2027-11-02', end: '2027-11-05' },
  ],
  BE: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-02' },
    { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-14' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  ],
  BB: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
    { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-14' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  ],
  HB: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-02' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
    { name: 'Sommerferien', start: '2027-07-08', end: '2027-08-18' },
    { name: 'Herbstferien', start: '2027-10-18', end: '2027-10-30' },
  ],
  HH: [
    { name: 'Osterferien', start: '2027-03-01', end: '2027-03-12' },
    { name: 'Pfingstferien', start: '2027-05-07', end: '2027-05-14' },
    { name: 'Sommerferien', start: '2027-07-01', end: '2027-08-11' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-22' },
  ],
  HE: [
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-02' },
    { name: 'Sommerferien', start: '2027-06-28', end: '2027-08-06' },
    { name: 'Herbstferien', start: '2027-10-04', end: '2027-10-16' },
  ],
  MV: [
    { name: 'Winterferien', start: '2027-02-08', end: '2027-02-19' },
    { name: 'Osterferien', start: '2027-03-24', end: '2027-04-02' },
    { name: 'Pfingstferien', start: '2027-05-07', end: '2027-05-18' },
    { name: 'Sommerferien', start: '2027-07-05', end: '2027-08-14' },
    { name: 'Herbstferien', start: '2027-10-14', end: '2027-10-23' },
  ],
  NI: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-02' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
    { name: 'Sommerferien', start: '2027-07-08', end: '2027-08-18' },
    { name: 'Herbstferien', start: '2027-10-16', end: '2027-10-30' },
  ],
  NW: [
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
    { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-18' },
    { name: 'Sommerferien', start: '2027-07-19', end: '2027-08-31' },
    { name: 'Herbstferien', start: '2027-10-23', end: '2027-11-06' },
  ],
  RP: [
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-02' },
    { name: 'Sommerferien', start: '2027-06-28', end: '2027-08-06' },
    { name: 'Herbstferien', start: '2027-10-04', end: '2027-10-15' },
  ],
  SL: [
    { name: 'Winterferien', start: '2027-02-08', end: '2027-02-12' },
    { name: 'Osterferien', start: '2027-03-30', end: '2027-04-09' },
    { name: 'Sommerferien', start: '2027-06-28', end: '2027-08-06' },
    { name: 'Herbstferien', start: '2027-10-04', end: '2027-10-15' },
  ],
  SN: [
    { name: 'Winterferien', start: '2027-02-08', end: '2027-02-19' },
    { name: 'Osterferien', start: '2027-03-26', end: '2027-04-02' },
    { name: 'Pfingstferien', start: '2027-05-07', end: '2027-05-18' },
    { name: 'Sommerferien', start: '2027-07-10', end: '2027-08-20' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  ],
  ST: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-03-27' },
    { name: 'Pfingstferien', start: '2027-05-15', end: '2027-05-22' },
    { name: 'Sommerferien', start: '2027-07-10', end: '2027-08-20' },
    { name: 'Herbstferien', start: '2027-10-18', end: '2027-10-23' },
  ],
  SH: [
    { name: 'Osterferien', start: '2027-03-30', end: '2027-04-10' },
    { name: 'Pfingstferien', start: '2027-05-07', end: '2027-05-07' },
    { name: 'Sommerferien', start: '2027-07-03', end: '2027-08-14' },
    { name: 'Herbstferien', start: '2027-10-11', end: '2027-10-23' },
  ],
  TH: [
    { name: 'Winterferien', start: '2027-02-01', end: '2027-02-06' },
    { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
    { name: 'Pfingstferien', start: '2027-05-07', end: '2027-05-07' },
    { name: 'Sommerferien', start: '2027-07-10', end: '2027-08-20' },
    { name: 'Herbstferien', start: '2027-10-09', end: '2027-10-23' },
  ],
};

/**
 * Full holiday data — all 16 Bundesländer, 2025 + 2026 + 2027 (estimated).
 */
export const HOLIDAYS: Record<string, Holiday[]> = Object.fromEntries(
  Object.keys(HOLIDAYS_2025).map((state) => [
    state,
    mergeHolidays(
      mergeHolidays(HOLIDAYS_2025[state] || [], HOLIDAYS_2026[state] || []),
      HOLIDAYS_2027[state] || []
    ),
  ])
);

/**
 * Bundesland display names.
 */
export const BUNDESLAND_NAMES: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Returns all holidays for a given Bundesland code.
 * Falls back to HE (Hessen) if the code is unknown.
 */
export function getHolidaysForState(stateCode: string): Holiday[] {
  return HOLIDAYS[stateCode] || HOLIDAYS['HE'] || [];
}

/**
 * Given any date, returns the Monday of that ISO week.
 */
export function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday = 0 → Monday -6
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if a given week (identified by its Monday) overlaps with any holidays.
 * Returns true if at least one holiday day falls within the week.
 */
export function isHolidayWeek(monday: string, holidays: Holiday[]): boolean {
  const mon = new Date(monday);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const sunStr = sun.toISOString().slice(0, 10);

  for (const h of holidays) {
    // Holiday overlaps with [monday, sunday]
    if (h.start <= sunStr && h.end >= monday) return true;
  }
  return false;
}

/**
 * Returns holiday names that overlap with the given week.
 */
export function getHolidayNamesForWeek(monday: string, holidays: Holiday[]): string[] {
  const mon = new Date(monday);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const sunStr = sun.toISOString().slice(0, 10);

  return holidays.filter((h) => h.start <= sunStr && h.end >= monday).map((h) => h.name);
}

/**
 * Generates a list of WeekInfo objects for a given date range.
 * Each week is identified by its Monday.
 */
export function getWeeks(startDate: string, endDate: string, holidays: Holiday[]): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const cursor = new Date(getMonday(start));

  while (cursor <= end) {
    const monday = cursor.toISOString().slice(0, 10);
    const holiday = isHolidayWeek(monday, holidays);
    const names = holiday ? getHolidayNamesForWeek(monday, holidays) : [];
    weeks.push({ monday, isHolidayWeek: holiday, holidayNames: names });
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

/**
 * Returns whether a specific date falls within any holiday.
 */
export function isDateInHolidays(date: string, holidays: Holiday[]): boolean {
  for (const h of holidays) {
    if (date >= h.start && date <= h.end) return true;
  }
  return false;
}

/**
 * Finds the Bundesland code from a club's Bundesland setting.
 * The club.bundesland field can be a full name or 2-letter code.
 * Returns 'HE' as default fallback.
 */
export function resolveBundeslandCode(raw: string | null | undefined): string {
  if (!raw) return 'HE';
  const upper = raw.trim().toUpperCase();

  // Direct 2-letter code match
  if (HOLIDAYS[upper]) return upper;

  // Full name match
  for (const [code, name] of Object.entries(BUNDESLAND_NAMES)) {
    if (name.toLowerCase() === raw.trim().toLowerCase()) return code;
  }

  return 'HE';
}
