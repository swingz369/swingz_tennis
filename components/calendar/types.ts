/** Saisonplan-Eintrag, wie ihn der Platzkalender darstellt (Zeitraster-Zelle). */
export interface PlanEntry {
  id: string;
  group_id: string | null;
  group_name: string;
  group_color: string;
  trainer_id: string;
  trainer_name?: string;
  court_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  [k: string]: unknown;
}
