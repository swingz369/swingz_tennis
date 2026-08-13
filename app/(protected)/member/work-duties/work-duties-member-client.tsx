'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  HardHat,
  Wrench,
  GlassWater,
  Sparkles,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  HandHeart,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  member_id: string;
  status: string;
  completed_at: string | null;
}

interface WorkDuty {
  id: string;
  title: string;
  description: string | null;
  duty_type: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  max_participants: number;
  status: string;
  priority: string;
  work_duty_assignments: Assignment[];
}

const dutyTypeLabels: Record<string, { label: string; icon: typeof HardHat; color: string }> = {
  court_maintenance: {
    label: 'Platzpflege',
    icon: Wrench,
    color: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300',
  },
  event_support: {
    label: 'Veranstaltung',
    icon: Calendar,
    color: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300',
  },
  bar_duty: {
    label: 'Schankdienst',
    icon: GlassWater,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
  },
  cleaning: {
    label: 'Reinigung',
    icon: Sparkles,
    color: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300',
  },
  coaching_assist: {
    label: 'Trainerhilfe',
    icon: Users,
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
  },
  other: {
    label: 'Sonstiges',
    icon: HardHat,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  },
};

type ViewTab = 'my_duties' | 'available';

export default function WorkDutiesMemberClient({ userId }: { userId: string }) {
  const [duties, setDuties] = useState<WorkDuty[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ViewTab>('my_duties');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDuties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/work-duties');
      if (res.ok) {
        const data = await res.json();
        setDuties(data.duties ?? []);
      }
    } catch {
      toast.error('Fehler beim Laden der Arbeitsdienste');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDuties();
  }, [fetchDuties]);

  // Split duties into "mine" and "available"
  const myDuties = duties.filter((d) =>
    d.work_duty_assignments.some((a) => a.member_id === userId)
  );

  const availableDuties = duties.filter((d) => {
    // Not cancelled or completed
    if (d.status === 'completed' || d.status === 'cancelled') return false;
    // Not already assigned to this member
    if (d.work_duty_assignments.some((a) => a.member_id === userId)) return false;
    // Has open slots
    return (d.work_duty_assignments?.length ?? 0) < d.max_participants;
  });

  const displayDuties = activeTab === 'my_duties' ? myDuties : availableDuties;

  const handleVolunteer = async (dutyId: string) => {
    setActionLoading(dutyId);
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/volunteer`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Fehler beim Eintragen');
        return;
      }
      toast.success('Erfolgreich eingetragen!');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Eintragen');
    } finally {
      setActionLoading(null);
    }
  };

  const handleWithdraw = async (dutyId: string) => {
    setActionLoading(dutyId);
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/volunteer`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Fehler beim Austragen');
        return;
      }
      toast.success('Erfolgreich ausgetragen');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Austragen');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkComplete = async (dutyId: string) => {
    setActionLoading(dutyId);
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/complete`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Fehler beim Aktualisieren');
        return;
      }
      toast.success('Als erledigt markiert!');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setActionLoading(null);
    }
  };

  const getMyAssignmentStatus = (duty: WorkDuty): string | null => {
    const myAssignment = duty.work_duty_assignments.find((a) => a.member_id === userId);
    return myAssignment?.status ?? null;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden…</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-info-600">
              {myDuties.filter((d) => getMyAssignmentStatus(d) === 'assigned').length}
            </p>
            <p className="text-xs text-muted-foreground">Anstehend</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success-600">
              {myDuties.filter((d) => getMyAssignmentStatus(d) === 'completed').length}
            </p>
            <p className="text-xs text-muted-foreground">Erledigt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning-600">{availableDuties.length}</p>
            <p className="text-xs text-muted-foreground">Freiwillige Plätze</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher — shadcn Tabs statt Inline-Pills, identisch zu den
          Admin-Tab-Leisten (members, settings, documents). Der Inhalt unten
          bleibt bewusst ein gemeinsames Rendering über `displayDuties`. */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
        <TabsList>
          <TabsTrigger value="my_duties">
            <HardHat className="h-4 w-4 mr-2" />
            Meine Dienste ({myDuties.length})
          </TabsTrigger>
          <TabsTrigger value="available">
            <HandHeart className="h-4 w-4 mr-2" />
            Freiwillig melden ({availableDuties.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Duty List */}
      {displayDuties.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <HardHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">
            {activeTab === 'my_duties'
              ? 'Keine zugewiesenen Dienste'
              : 'Keine freien Dienste verfügbar'}
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            {activeTab === 'my_duties'
              ? 'Schau unter "Freiwillig melden" nach verfügbaren Einsätzen.'
              : 'Alle Plätze sind besetzt oder es gibt keine offenen Dienste.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayDuties.map((duty) => {
            const typeInfo = dutyTypeLabels[duty.duty_type] ?? dutyTypeLabels.other;
            const assignedCount = duty.work_duty_assignments?.length ?? 0;
            const TypeIcon = typeInfo.icon;
            const myStatus = getMyAssignmentStatus(duty);
            const isLoading = actionLoading === duty.id;
            const isPast = duty.scheduled_date && new Date(duty.scheduled_date) < new Date();

            return (
              <Card key={duty.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl ${typeInfo.color}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{duty.title}</h3>
                        {duty.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{duty.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
                          {myStatus && (
                            <Badge
                              className={`${
                                myStatus === 'completed'
                                  ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300'
                                  : 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300'
                              } text-xs gap-1`}
                            >
                              {myStatus === 'completed' ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" /> Erledigt
                                </>
                              ) : (
                                <>
                                  <Users className="h-3 w-3" /> Eingetragen
                                </>
                              )}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                      {duty.scheduled_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(duty.scheduled_date)}
                          {isPast && <span className="text-error-500 ml-1">(vergangen)</span>}
                        </div>
                      )}
                      {duty.start_time && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {duty.start_time}
                          {duty.end_time ? ` – ${duty.end_time}` : ''}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <Users className="h-3 w-3" />
                        {assignedCount}/{duty.max_participants} Plätze
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    {activeTab === 'available' && !myStatus && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => handleVolunteer(duty.id)}
                        disabled={isLoading}
                      >
                        <HandHeart className="h-3.5 w-3.5" />
                        {isLoading ? 'Eintragen…' : 'Freiwillig melden'}
                      </Button>
                    )}

                    {activeTab === 'my_duties' && myStatus === 'assigned' && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1.5 bg-success-600 hover:bg-success-700"
                          onClick={() => handleMarkComplete(duty.id)}
                          disabled={isLoading}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isLoading ? 'Speichern…' : 'Als erledigt markieren'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-error-600 hover:text-error-700"
                          onClick={() => handleWithdraw(duty.id)}
                          disabled={isLoading}
                        >
                          <X className="h-3.5 w-3.5" />
                          Austragen
                        </Button>
                      </>
                    )}

                    {activeTab === 'my_duties' && myStatus === 'completed' && (
                      <Badge className="bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300 text-xs gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Erledigt — Vielen Dank!
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
