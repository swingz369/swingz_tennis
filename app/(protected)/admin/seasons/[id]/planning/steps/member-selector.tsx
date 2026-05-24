'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, TrendingUp, Clock, Star, AlertCircle, CheckCircle, Search } from 'lucide-react';
import { useWizard } from '@/lib/season-planning/wizard-context';
import type { SelectMembersResponse } from '@/lib/season-planning/types';
import type { SkillLevel } from '@/lib/types/season-planning';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Skeleton,
  Input,
  Checkbox,
} from '@/components/ui';

interface MemberRow {
  id: string;
  name: string;
  email: string;
  skillLevel: SkillLevel;
  experienceMonths: number;
  attendanceQuote: number | null;
  readyForNextLevel: boolean;
  recommendedLevel: SkillLevel | null;
  trainerName: string | null;
  wasWaitlisted: boolean;
  includeInPlanning: boolean;
}

export function MemberSelector() {
  const { state, dispatch } = useWizard();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<SkillLevel | 'all'>('all');
  const [showExcluded, setShowExcluded] = useState(false);
  const [promotedMembers, setPromotedMembers] = useState<SelectMembersResponse['promotedMembers']>(
    []
  );
  const [waitlistCarryovers, setWaitlistCarryovers] = useState<
    SelectMembersResponse['waitlistCarryovers']
  >([]);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/seasons/${state.seasonId}/planning/members`);
      if (!res.ok) throw new Error('Fehler beim Laden der Mitglieder');
      const data = await res.json();

      setMembers(data.members || []);
      setPromotedMembers(data.promotedMembers || []);
      setWaitlistCarryovers(data.waitlistCarryovers || []);

      // Pre-select all members
      const allIds = (data.members || []).map((m: MemberRow) => m.id);
      dispatch({
        type: 'SELECT_MEMBERS',
        memberIds: allIds,
        promotedIds: data.promotedMembers?.map((p: { memberId: string }) => p.memberId) || [],
        response: {
          success: true,
          selectedCount: allIds.length,
          promotedMembers: data.promotedMembers || [],
          waitlistCarryovers: data.waitlistCarryovers || [],
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [state.seasonId, dispatch]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const toggleMember = (memberId: string) => {
    const newIds = state.selectedMemberIds.includes(memberId)
      ? state.selectedMemberIds.filter((id) => id !== memberId)
      : [...state.selectedMemberIds, memberId];

    dispatch({
      type: 'SELECT_MEMBERS',
      memberIds: newIds,
      promotedIds: state.promotedMemberIds,
      response: {
        success: true,
        selectedCount: newIds.length,
        promotedMembers,
        waitlistCarryovers,
      },
    });
  };

  const toggleAll = () => {
    const allSelected = state.selectedMemberIds.length === members.length;
    const newIds = allSelected ? [] : members.map((m) => m.id);
    dispatch({
      type: 'SELECT_MEMBERS',
      memberIds: newIds,
      promotedIds: state.promotedMemberIds,
      response: {
        success: true,
        selectedCount: newIds.length,
        promotedMembers,
        waitlistCarryovers,
      },
    });
  };

  const levelBadgeColor: Record<string, string> = {
    beginner: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    intermediate: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    advanced: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    professional: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = filterLevel === 'all' || m.skillLevel === filterLevel;
    const matchesPlanning = showExcluded || m.includeInPlanning !== false;
    return matchesSearch && matchesLevel && matchesPlanning;
  });

  const selectedCount = state.selectedMemberIds.length;
  const allSelected = selectedCount === members.length && members.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="mt-2 text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              Mitglieder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{members.length}</p>
            <p className="text-xs text-muted-foreground">{selectedCount} ausgewählt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Höherstufungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{promotedMembers.length}</p>
            <p className="text-xs text-muted-foreground">Bereit für nächstes Level</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Warteliste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{waitlistCarryovers.length}</p>
            <p className="text-xs text-muted-foreground">Noch kein Platz erhalten</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Auswahl
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {members.length > 0 ? Math.round((selectedCount / members.length) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Ausgewählt</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mitglied suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'beginner', 'intermediate', 'advanced', 'professional'] as const).map(
            (level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filterLevel === level
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {level === 'all' ? 'Alle' : level}
              </button>
            )
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExcluded(!showExcluded)}
          className={`text-xs ${showExcluded ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
        >
          {showExcluded ? 'Zeige alle' : 'Nur eingeplante'}
        </Button>
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2">
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all" />
        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
          Alle auswählen ({selectedCount}/{members.length})
        </label>
      </div>

      {/* Members Table */}
      <div className="rounded-lg border bg-white dark:bg-surface-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                <th className="w-10 px-4 py-3 text-left"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Niveau
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Erfahrung
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Anwesenheit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Hinweise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMembers.map((member) => {
                const isSelected = state.selectedMemberIds.includes(member.id);
                const isPromoted = promotedMembers.some((p) => p.memberId === member.id);
                const isWaitlisted = waitlistCarryovers.some((w) => w.memberId === member.id);

                return (
                  <tr
                    key={member.id}
                    className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                      isSelected ? 'bg-brand-light/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={`text-xs ${levelBadgeColor[member.skillLevel] || ''}`}
                        variant="outline"
                      >
                        {member.skillLevel}
                      </Badge>
                      {isPromoted && (
                        <div className="mt-1">
                          <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                            ↑ {member.recommendedLevel}
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{member.experienceMonths} Mon.</td>
                    <td className="px-4 py-3 text-sm">
                      {member.attendanceQuote !== null ? (
                        <span
                          className={
                            member.attendanceQuote >= 80
                              ? 'text-green-600'
                              : member.attendanceQuote >= 50
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }
                        >
                          {member.attendanceQuote}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {member.includeInPlanning === false && (
                          <Badge className="text-xs bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Ausgeschlossen
                          </Badge>
                        )}
                        {isPromoted && (
                          <Badge className="text-xs bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            Höherstufung
                          </Badge>
                        )}
                        {isWaitlisted && (
                          <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Warteliste Vorsaison
                          </Badge>
                        )}
                        {member.includeInPlanning !== false && !isPromoted && !isWaitlisted && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredMembers.length === 0 && (
          <div className="py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Keine Mitglieder gefunden</p>
          </div>
        )}
      </div>

      {/* Promoted Members Detail */}
      {promotedMembers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              Automatische Höherstufungen
            </CardTitle>
            <CardDescription>
              Diese Mitglieder werden beim Clustering eine Stufe höher eingeordnet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {promotedMembers.map((p) => (
                <li key={p.memberId} className="flex items-center gap-3 text-sm">
                  <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="font-medium">{p.memberName}</span>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-xs">
                    {p.recommendedLevel}
                  </Badge>
                  <span className="text-muted-foreground text-xs">(Trainer: {p.trainerName})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
