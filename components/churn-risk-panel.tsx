'use client';
import { extractErrorMessage } from '@/lib/typed-helpers';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Mail,
  UserX,
  TrendingDown,
  DollarSign,
  CalendarX,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AnimatedCounter } from '@/components/animations';
import { apiFetch } from '@/lib/api-fetch';

interface AtRiskMember {
  userId: string;
  name: string;
  email: string;
  riskScore: number;
  reasons: string[];
  riskLevel: 'high' | 'medium' | 'low';
  trends?: {
    attendanceDecline: boolean;
    bookingDecline: boolean;
    hasOverdueInvoices: boolean;
  };
}

interface ChurnData {
  atRisk: AtRiskMember[];
  churnRiskRate: number;
  totalMembers: number;
}

type RiskFilter = 'all' | 'high' | 'medium';

export function ChurnRiskPanel() {
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/churn-risk');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Fehler beim Laden' }));
        throw new Error(extractErrorMessage(err) || `HTTP ${res.status}`);
      }
      const json: ChurnData = await res.json();
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

  const filteredMembers =
    data?.atRisk.filter((m) => {
      if (riskFilter === 'all') return true;
      return m.riskLevel === riskFilter;
    }) ?? [];

  const highCount = data?.atRisk.filter((m) => m.riskLevel === 'high').length ?? 0;
  const mediumCount = data?.atRisk.filter((m) => m.riskLevel === 'medium').length ?? 0;

  const riskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-error-600 bg-error-50 border-error-200';
      case 'medium':
        return 'text-warning-600 bg-warning-50 border-warning-200';
      default:
        return 'text-info-600 bg-info-50 border-info-200';
    }
  };

  const TrendIcons = ({ trends }: { trends: AtRiskMember['trends'] }) => {
    if (!trends) return null;
    return (
      <>
        {trends.attendanceDecline && (
          <CalendarX className="h-3.5 w-3.5 text-error-500" aria-label="Keine Anwesenheit" />
        )}
        {trends.bookingDecline && (
          <TrendingDown className="h-3.5 w-3.5 text-warning-500" aria-label="Buchungsrückgang" />
        )}
        {trends.hasOverdueInvoices && (
          <DollarSign
            className="h-3.5 w-3.5 text-brand-accent-500"
            aria-label="Offene Rechnungen"
          />
        )}
      </>
    );
  };

  return (
    <Card variant="bordered" className="transition-all duration-300 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-error-50">
            <AlertTriangle className="h-5 w-5 text-error-500" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Churn Prediction</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Mitglieder mit Kündigungsrisiko</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">
                <AnimatedCounter value={data.churnRiskRate} duration={1000} suffix="%" />
              </p>
              <p className="text-xs text-muted-foreground">Risiko-Rate</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !data && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-error-50 rounded-xl text-error-600 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && data.atRisk.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mb-2 text-success-500" />
            <p className="text-sm font-medium">Keine gefährdeten Mitglieder</p>
            <p className="text-xs">Alle {data.totalMembers} Mitglieder sind aktiv</p>
          </div>
        )}

        {data && data.atRisk.length > 0 && (
          <>
            {/* Filter badges */}
            <div className="flex gap-2 mb-4">
              {(['all', 'high', 'medium'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRiskFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    riskFilter === filter
                      ? filter === 'high'
                        ? 'bg-error-100 text-error-700'
                        : filter === 'medium'
                          ? 'bg-warning-100 text-warning-700'
                          : 'bg-muted text-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {filter === 'all'
                    ? `Alle (${data.atRisk.length})`
                    : filter === 'high'
                      ? `High (${highCount})`
                      : `Medium (${mediumCount})`}
                </button>
              ))}
            </div>

            {/* Member list */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredMembers.map((member) => {
                  const isExpanded = expandedMember === member.userId;
                  return (
                    <div
                      key={member.userId}
                      className={`rounded-xl border p-3 transition-all duration-200 ${
                        isExpanded ? 'shadow-sm' : ''
                      } ${riskColor(member.riskLevel)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{member.name}</span>
                            <Badge
                              variant={member.riskLevel === 'high' ? 'error' : 'warning'}
                              className="text-2xs px-1.5 py-0"
                            >
                              {member.riskScore}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Trend icons */}
                          <TrendIcons trends={member.trends} />
                          <button
                            onClick={() => setExpandedMember(isExpanded ? null : member.userId)}
                            className="ml-1 p-1 hover:bg-black/5 rounded"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/50 space-y-3">
                          <div>
                            <p className="text-xs font-medium mb-1">Risikofaktoren:</p>
                            <ul className="space-y-1">
                              {member.reasons.map((reason, i) => (
                                <li key={i} className="text-xs flex items-start gap-1.5">
                                  <span className="mt-0.5">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <Mail className="h-3 w-3" />
                              Kontaktieren
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <UserX className="h-3 w-3" />
                              Profil
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
