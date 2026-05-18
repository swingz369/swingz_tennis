'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWizard } from '@/lib/season-planning/wizard-context';
import {
  Sparkles,
  Users,
  Clock,
  Target,
  Heart,
  Star,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type {
  ClusteringResult,
  GroupAssignment,
} from '@/lib/season-planning/types';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function ClusteringResult() {
  const { state } = useWizard();
  const [result, setResult] = useState<ClusteringResult | null>(state.clusteringResult);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (state.clusteringResult) {
      setResult(state.clusteringResult);
    }
  }, [state.clusteringResult]);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Sparkles className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Clustering noch nicht ausgeführt
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Führen Sie das KI-Clustering aus, um die optimale Gruppenzuteilung zu
            berechnen. Dies erfolgt automatisch beim Wechsel zu diesem Schritt.
          </p>
        </div>
      </div>
    );
  }

  const metrics = result.metrics;

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" />
              <p className="text-xs text-muted-foreground">Gruppen</p>
            </div>
            <p className="text-xl font-bold mt-1">{metrics.totalGroups}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Niveau-Match</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {Math.round(metrics.avgNiveauMatch)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-400" />
              <p className="text-xs text-muted-foreground">Wunschpartner</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {Math.round(metrics.wishPartnerRate)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.wishPartnerFulfilled}/{metrics.wishPartnerRequests}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Trainer</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {Math.round(metrics.avgTrainerUtilization)}%
            </p>
            <p className="text-xs text-muted-foreground">Auslastung</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-xs text-muted-foreground">Hinweise</p>
            </div>
            <p className="text-xl font-bold mt-1">
              {metrics.niveauSpanViolations + metrics.highRiskSlotsUsed + metrics.trainerOverloadWarnings}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Groups Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {result.groups.map((group) => (
          <GroupCard
            key={group.groupId}
            group={group}
            isSelected={selectedGroupId === group.groupId}
            onSelect={() =>
              setSelectedGroupId(
                selectedGroupId === group.groupId ? null : group.groupId
              )
            }
          />
        ))}
      </div>

      {/* Explanations */}
      {result.explanations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-primary" />
              KI-Erklärungen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.explanations.map((exp, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {exp}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Waitlist Summary */}
      {result.waitlistSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Wartelisten ({result.waitlistSummary.length})
            </CardTitle>
            <CardDescription>
              Mitglieder auf Wartelisten mit Alternativ-Zuweisung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.waitlistSummary.map((w, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{w.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      Warteliste: {w.groupName} (Pos. {w.position})
                    </p>
                  </div>
                  {w.alternativeGroupName && (
                    <Badge variant="outline" className="text-xs">
                      Alternativ: {w.alternativeGroupName}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unassigned Members */}
      {result.unassignedMembers.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Nicht zugewiesene Mitglieder ({result.unassignedMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.unassignedMembers.map((m) => (
                <div
                  key={m.memberId}
                  className="flex items-center justify-between rounded-lg border border-red-100 bg-white p-3 text-sm"
                >
                  <span className="font-medium">{m.memberName}</span>
                  <span className="text-red-600 text-xs">{m.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runtime Info */}
      <p className="text-xs text-muted-foreground text-right">
        Clustering in {metrics.runtimeMs}ms abgeschlossen · {metrics.iterations} Gruppen gebildet
      </p>
    </div>
  );
}

// ============================================
// GROUP CARD COMPONENT
// ============================================

function GroupCard({
  group,
  isSelected,
  onSelect,
}: {
  group: GroupAssignment;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-brand-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{group.groupName}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {DAY_NAMES[group.dayOfWeek]} {group.startTime}-{group.endTime}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs">
            {group.memberIds.length} Mitglieder
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {group.trainerName}
          </span>
          {group.courtName && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" /> {group.courtName}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.warnings.length > 0 && (
          <div className="space-y-1 mb-3">
            {group.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5"
              >
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          {group.memberDetails.map((detail) => (
            <div
              key={detail.memberId}
              className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">
                  {detail.memberName}
                </span>
                {detail.isPromoted && (
                  <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">
                    <Star className="h-3 w-3 mr-0.5" />↑
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs font-medium ${
                    detail.niveauMatch >= 90
                      ? 'text-green-600'
                      : detail.niveauMatch >= 70
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {detail.niveauMatch}%
                </span>
                {detail.wishPartnerFulfilled && (
                  <Heart className="h-3 w-3 text-red-400" />
                )}
              </div>
            </div>
          ))}
        </div>

        {group.waitlistDetails.length > 0 && (
          <div className="pt-2 mt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Warteliste:
            </p>
            <div className="space-y-0.5">
              {group.waitlistDetails.map((w) => (
                <div
                  key={w.memberId}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Clock className="h-3 w-3" />
                  {w.memberName} (Pos. {w.position})
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
