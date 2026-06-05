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
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';

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
  beginner: 'bg-green-100 text-green-700 border-green-200',
  advanced_beginner: 'bg-blue-100 text-blue-700 border-blue-200',
  intermediate: 'bg-amber-100 text-amber-700 border-amber-200',
  advanced: 'bg-orange-100 text-orange-700 border-orange-200',
  tournament: 'bg-purple-100 text-purple-700 border-purple-200',
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-gray-600';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-blue-500';
}

function getLevelColor(level: string): string {
  return levelColors[level] || 'bg-gray-100 text-gray-700 border-gray-200';
}

export function MatchmakingPanel() {
  const [data, setData] = useState<MatchmakingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);

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
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <Shuffle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Matchmaking</h2>
            <p className="text-xs text-gray-500">
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
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <RefreshCw className="h-8 w-8 animate-spin mb-3 text-blue-400" />
          <p className="text-sm font-medium">Suche nach passenden Partnern...</p>
          <p className="text-xs">Analysiere Level, Gruppen und gemeinsame Sessions</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-600 text-sm border border-red-200">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {data && data.matches.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="h-12 w-12 mb-3 text-gray-300" />
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                      isSelected ? 'ring-2 ring-blue-400 shadow-md' : ''
                    }`}
                    onClick={() => setSelectedMatch(isSelected ? null : match.userId)}
                  >
                    <CardContent className="p-4">
                      {/* Top row: Name + Score */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {match.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{match.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{match.email}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center ml-2">
                          <span
                            className={`text-xl font-bold tabular-nums ${getScoreColor(match.compatibilityScore)}`}
                          >
                            {match.compatibilityScore}
                          </span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wider">
                            Score
                          </span>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(match.compatibilityScore)}`}
                          style={{ width: `${match.compatibilityScore}%` }}
                        />
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 border ${getLevelColor(match.playingLevel)} bg-white`}
                        >
                          <Target className="h-2.5 w-2.5 mr-1" />
                          {getLevelLabel(match.playingLevel)}
                        </Badge>
                        {match.groupOverlap.length > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200"
                          >
                            <Users className="h-2.5 w-2.5 mr-1" />
                            {match.groupOverlap.length} Gruppen
                          </Badge>
                        )}
                        {match.commonSessions > 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-cyan-50 text-cyan-700 border-cyan-200"
                          >
                            <Calendar className="h-2.5 w-2.5 mr-1" />
                            {match.commonSessions} Sessions
                          </Badge>
                        )}
                        {match.levelDiff === 0 && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200"
                          >
                            <Star className="h-2.5 w-2.5 mr-1" />
                            Gleiches Level
                          </Badge>
                        )}
                      </div>

                      {/* Reasons */}
                      <div className="space-y-1 mb-3">
                        {match.reasons.map((reason, i) => (
                          <p key={i} className="text-[11px] text-gray-500 flex items-start gap-1.5">
                            <Sparkles className="h-3 w-3 text-blue-400 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </p>
                        ))}
                      </div>

                      {/* Expandable details */}
                      {isSelected && (
                        <div className="border-t pt-3 mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 bg-gray-50 rounded-lg text-center">
                              <p className="text-lg font-semibold text-gray-900 tabular-nums">
                                {match.compatibilityScore}
                              </p>
                              <p className="text-[10px] text-gray-500">Gesamt-Score</p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-lg text-center">
                              <p className="text-lg font-semibold text-gray-900 tabular-nums">
                                {match.commonSessions}
                              </p>
                              <p className="text-[10px] text-gray-500">Sessions</p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-lg text-center">
                              <p className="text-lg font-semibold text-gray-900 tabular-nums">
                                {match.groupOverlap.length}
                              </p>
                              <p className="text-[10px] text-gray-500">Gruppen</p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-lg text-center">
                              <p className="text-lg font-semibold text-gray-900">
                                <span
                                  className={
                                    match.levelDiff === 0
                                      ? 'text-green-600'
                                      : match.levelDiff <= 1
                                        ? 'text-amber-600'
                                        : 'text-gray-600'
                                  }
                                >
                                  {match.levelDiff}
                                </span>
                              </p>
                              <p className="text-[10px] text-gray-500">Level-Diff</p>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="h-8 text-xs gap-1.5 flex-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Nachricht
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 flex-1"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              Herausfordern
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Click hint */}
                      {!isSelected && (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400 pt-1">
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
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
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
              <Badge variant="outline" className="text-[10px] gap-1">
                <Shuffle className="h-3 w-3" />
                KI-gestützt
              </Badge>
            </div>
          )}
        </>
      )}
    </div>
  );
}
