export interface TeamMember {
  id: string;
  team_id: string;
  member_id: string;
  role: string;
  position_number: number | null;
  is_active: boolean;
  name: string;
  dtb_id: string | null;
}

export interface Team {
  id: string;
  name: string;
  captain_id: string | null;
  position: number | null;
  points: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  notes: string | null;
  members: TeamMember[];
}

export interface MatchDay {
  id: string;
  matchday_number: number;
  scheduled_date: string | null;
  opponent: string;
  is_home: boolean;
  venue: string | null;
  result: string | null;
  score_home: number | null;
  score_away: number | null;
  status: string;
  notes: string | null;
  nuliga_report_url: string | null;
  /** Anzahl der für diesen Spieltag gesperrten Plätze (0 = nicht gesperrt). */
  blocked_courts: number;
}

export interface LeaguePlayer {
  id: string;
  name: string;
  lk: string | null;
  position_number: number | null;
  member_id: string | null;
  synced_at: string;
}

export interface League {
  id: string;
  name: string;
  season_year: number;
  league_type: string;
  division: string | null;
  sport: string;
  age_group: string | null;
  status: string;
  notes: string | null;
  nuliga_url: string | null;
  own_team_name: string | null;
  nuliga_roster_url: string | null;
  last_synced_at: string | null;
  teams: Team[];
  match_days: MatchDay[];
  players: LeaguePlayer[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
}
