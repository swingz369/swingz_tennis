'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card as MatchCard, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Shuffle,
  Users,
  Target,
  Calendar,
  RefreshCw,
  Search,
  Star,
  Zap,
  ChevronRight,
  MessageSquare,
  UserPlus,
  AlertCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface MatchCandidate {
  userId: string;
  name: string;
  email: string;
  playingLevel: string;
  compatibilityScore: number;
  groupOverlap: string[];
  commonSessions: number;
  levelDiff: number;
  reasons: string[];
}

interface MatchmakingData {
  matches: MatchCandidate[];
  totalMembers: number;
  myLevel: string;
}

const levelLabels: Record<string, string> = {
  beginner: 'Anfänger',
  advanced_beginner: 'Fortgeschrittener Anfänger',
  intermediate: 'Mittelstufe',
  advanced: 'Fortgeschritten',
  tournament: 'Turnierniveau',
};

const levelColors: Record<string, string> = {
  beginner: 'bg-success-100 text-success-700 border-success-200',
  advanced_beginner: 'bg-info-100 text-info-700 border-info-200',
  intermediate: 'bg-warning-100 text-warning-700 border-warning-200',
  advanced: 'bg-brand-accent-100 text-brand-accent-700 border-brand-accent-200',
  tournament: 'bg-info-100 text-info-700 border-info-200',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success-600';
  if (score >= 60) return 'text-warning-600';
  return 'text-muted-foreground';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-success-500';
  if (score >= 60) return 'bg-warning-500';
  return 'bg-info-500';
}

function getLevelColor(level: string): string {
  return levelColors[level] || 'bg-muted text-foreground border-border';
}

interface MatchmakingPanelProps {
  showAdminBadge?: boolean;
}

export function MatchmakingPanel({ showAdminBadge }: MatchmakingPanelProps = {}) {
  const [data, setData] = useState<MatchmakingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [challengingId, setChallengingId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const router = useRouter();

  // Fetch clubId for open match creation
  useEffect(() => {
    apiFetch('/api/user/club')
      .then((res) => res.json())
      .then((d) => setClubId(d.clubId ?? null))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/ai/matchmaking');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler beim Laden' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const json: MatchmakingData = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMatches = (data?.matches ?? []).filter((m) => {
    if (levelFilter !== 'all' && m.playingLevel !== levelFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const uniqueLevels = [...new Set(data?.matches.map((m) => m.playingLevel) ?? [])];

  const getLevelLabel = (level: string) => levelLabels[level] || level;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-info-500 to-info-600 text-white">
            <Shuffle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Matchmaking</h2>
            <p className="text-xs text-muted-foreground">
              {data
                ? `${data.matches.length} potenzielle Partner gefunden`
                : 'Finde Trainingspartner mit passendem Level'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Star className="h-3 w-3" />
              Dein Level: {getLevelLabel(data.myLevel)}
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-info-400" />
          <p className="text-sm font-medium">Suche nach passenden Partnern...</p>
          <p className="text-xs">Analysiere Level, Gruppen und gemeinsame Sessions</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-error-50 rounded-lg text-error-600 text-sm border border-error-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {data && data.matches.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Users className="h-12 w-12 mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Keine passenden Partner gefunden</p>
          <p className="text-xs mt-1">
            Es wurden {data.totalMembers} Mitglieder im Verein analysiert.
          </p>
          <p className="text-xs">Versuche es später erneut, wenn mehr Mitglieder aktiv sind.</p>
        </div>
      )}

      {/* Has data */}
      {data && data.matches.length > 0 && (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nach Name oder E-Mail suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setLevelFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  levelFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                }`}
              >
                Alle ({data.matches.length})
              </button>
              {uniqueLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    levelFilter === level
                      ? getLevelColor(level)
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {getLevelLabel(level)}
                </button>
              ))}
            </div>
          </div>

          {/* Match cards grid */}
          <ScrollArea className="h-[520px] pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredMatches.map((match) => {
                const isSelected = selectedMatch === match.userId;
                return (
                  <MatchCard
                    key={match.userId}
                    variant={isSelected ? 'elevated' : 'bordered'}
                    className={`transition-all duration-200 cursor-pointer hover:shadow-md ${
                      isSelected ? 'ring-2 ring-info-400 shadow-md' : ''
                    }`}
                    onClick={() => setSelectedMatch(isSelected ? null : match.userId)}
                  >
                    <CardContent className="p-4">
                      {/* Top row: Name + Score */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-info-400 to-info-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {match.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{match.name}</p>
                              <p className="text-2xs text-muted-foreground truncate">
                                {match.email}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center ml-2">
                          <span
                            className={`text-xl font-bold tabular-nums ${getScoreColor(match.compatibilityScore)}`}
                          >
                            {match.compatibilityScore}
                          </span>
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                            Score
                          </span>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(match.compatibilityScore)}`}
                          style={{ width: `${match.compatibilityScore}%` }}
                        />
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge
                          variant="secondary"
                          className={`text-2xs px-1.5 py-0 border ${getLevelColor(match.playingLevel)} bg-background`}
                        >
                          <Target className="h-2.5 w-2.5 mr-1" />
                          {getLevelLabel(match.playingLevel)}
                        </Badge>
                        {match.groupOverlap.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-2xs px-1.5 py-0 bg-info-50 text-info-700 border-info-200"
                          >
                            <Users className="h-2.5 w-2.5 mr-1" />
                            {match.groupOverlap.length} Gruppen
                          </Badge>
                        )}
                        {match.commonSessions > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-2xs px-1.5 py-0 bg-info-50 text-info-700 border-info-200"
                          >
                            <Calendar className="h-2.5 w-2.5 mr-1" />
                            {match.commonSessions} Sessions
                          </Badge>
                        )}
                        {match.levelDiff === 0 && (
                          <Badge
                            variant="secondary"
                            className="text-2xs px-1.5 py-0 bg-success-50 text-success-700 border-success-200"
                          >
                            <Star className="h-2.5 w-2.5 mr-1" />
                            Gleiches Level
                          </Badge>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="space-y-1 mb-3">
                        {match.reasons.map((reason, i) => (
                          <p
                            key={i}
                            className="text-2xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <Sparkles className="h-3 w-3 text-info-400 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </p>
                        ))}
                      </div>

                      {/* Expandable details */}
                      {isSelected && (
                        <div className="border-t pt-3 mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-muted rounded-lg text-center">
                              <p className="text-lg font-semibold text-foreground tabular-nums">
                                {match.compatibilityScore}
                              </p>
                              <p className="text-2xs text-muted-foreground">Gesamt-Score</p>
                            </div>
                            <div className="p-2 bg-muted rounded-lg text-center">
                              <p className="text-lg font-semibold text-foreground tabular-nums">
                                {match.commonSessions}
                              </p>
                              <p className="text-2xs text-muted-foreground">Sessions</p>
                            </div>
                            <div className="p-2 bg-muted rounded-lg text-center">
                              <p className="text-lg font-semibold text-foreground tabular-nums">
                                {match.groupOverlap.length}
                              </p>
                              <p className="text-2xs text-muted-foreground">Gruppen</p>
                            </div>
                            <div className="p-2 bg-muted rounded-lg text-center">
                              <p className="text-lg font-semibold text-foreground">
                                <span
                                  className={
                                    match.levelDiff === 0
                                      ? 'text-success-600'
                                      : match.levelDiff <= 1
                                        ? 'text-warning-600'
                                        : 'text-muted-foreground'
                                  }
                                >
                                  {match.levelDiff}
                                </span>
                              </p>
                              <p className="text-2xs text-muted-foreground">Level-Diff</p>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/messages?compose=${match.userId}`);
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Nachricht
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 flex-1"
                              disabled={challengingId === match.userId}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!clubId) {
                                  toast.error('Kein aktiver Verein gefunden');
                                  return;
                                }
                                setChallengingId(match.userId);
                                try {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  const dateStr = tomorrow.toISOString().split('T')[0];
                                  const res = await apiFetch('/api/open-matches', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({
                                      clubId,
                                      title: `Match gegen ${match.name}`,
                                      description: `KI-Matchmaking: ${match.reasons.join(', ')}`,
                                      matchDate: dateStr,
                                      startTime: '10:00',
                                      endTime: '11:30',
                                      skillLevel: match.playingLevel,
                                      matchType: 'singles',
                                      maxPlayers: 2,
                                    }),
                                  });
                                  if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    throw new Error(err.error || 'Erstellung fehlgeschlagen');
                                  }
                                  toast.success(`Offenes Spiel gegen ${match.name} erstellt!`);
                                  router.push('/matches');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Fehler');
                                } finally {
                                  setChallengingId(null);
                                }
                              }}
                            >
                              {challengingId === match.userId ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" />
                              )}
                              Herausfordern
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Click hint */}
                      {!isSelected && (
                        <div className="flex items-center justify-center gap-1 text-2xs text-muted-foreground pt-1">
                          <span>Klicken für Details</span>
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      )}
                    </CardContent>
                  </MatchCard>
                );
              })}
            </div>
          </ScrollArea>

          {/* Summary footer */}
          {data && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {data.totalMembers} Mitglieder analysiert
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  Top {Math.min(10, data.matches.length)} Ergebnisse
                </span>
              </div>
              <div className="flex items-center gap-2">
                {showAdminBadge && (
                  <Badge variant="secondary" className="text-2xs gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Admin-Ansicht
                  </Badge>
                )}
                <Badge variant="outline" className="text-2xs gap-1">
                  <Shuffle className="h-3 w-3" />
                  KI-gestützt
                </Badge>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
