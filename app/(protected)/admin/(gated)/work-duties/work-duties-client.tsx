'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  HardHat,
  Plus,
  Wrench,
  GlassWater,
  Sparkles,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Trash2,
  Edit2,
  UserPlus,
  X,
  Copy,
  Repeat,
  CalendarRange,
  Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-fetch';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  member_id: string;
  status: string;
  completed_at: string | null;
  name?: string;
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
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  bar_duty: {
    label: 'Schankdienst',
    icon: GlassWater,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
  },
  cleaning: {
    label: 'Reinigung',
    icon: Sparkles,
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
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

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  open: {
    label: 'Offen',
    icon: AlertCircle,
    color: 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300',
  },
  assigned: {
    label: 'Zugewiesen',
    icon: Users,
    color: 'bg-info-100 text-info-800 dark:bg-info-900/30 dark:text-info-300',
  },
  completed: {
    label: 'Erledigt',
    icon: CheckCircle2,
    color: 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300',
  },
  cancelled: {
    label: 'Storniert',
    icon: XCircle,
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  },
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-info-100 text-info-700',
  high: 'bg-error-100 text-error-700',
};

export default function WorkDutiesClient({
  members,
}: {
  members: { id: string; name: string; email: string }[];
}) {
  const [duties, setDuties] = useState<WorkDuty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    duty_type: 'court_maintenance',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    max_participants: 1,
    priority: 'medium',
  });
  const [newDuty, setNewDuty] = useState({
    title: '',
    description: '',
    duty_type: 'court_maintenance',
    scheduled_date: '',
    start_time: '',
    end_time: '',
    max_participants: 1,
    priority: 'medium',
  });

  // Bulk-create state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState({
    title: '',
    description: '',
    duty_type: 'court_maintenance',
    start_time: '',
    end_time: '',
    max_participants: 1,
    priority: 'medium',
    notes: '',
  });
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [bulkRecurrence, setBulkRecurrence] = useState<string>('weekly');
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([6]); // default Saturday

  // Saved templates state
  const [savedTemplates, setSavedTemplates] = useState<Array<typeof bulkTemplate>>([]);
  const [templateName, setTemplateName] = useState('');

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

  const handleCreate = async () => {
    if (!newDuty.title) {
      toast.error('Titel erforderlich');
      return;
    }
    try {
      const res = await apiFetch('/api/work-duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDuty),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Arbeitsdienst erstellt');
      setShowNew(false);
      setNewDuty({
        title: '',
        description: '',
        duty_type: 'court_maintenance',
        scheduled_date: '',
        start_time: '',
        end_time: '',
        max_participants: 1,
        priority: 'medium',
      });
      fetchDuties();
    } catch {
      toast.error('Fehler beim Erstellen');
    }
  };

  const handleAssignMember = async (dutyId: string, memberId: string) => {
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: [memberId] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error('Mitglied bereits zugewiesen');
          return;
        }
        throw new Error(err.error || 'Failed');
      }
      toast.success('Mitglied zugewiesen');
      setMemberSearch('');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Zuweisen');
    }
  };

  const handleRemoveAssignment = async (dutyId: string, assignmentId: string) => {
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}/assign/${assignmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Zuweisung entfernt');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Entfernen');
    }
  };

  const handleCompleteDuty = async (dutyId: string) => {
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Arbeitsdienst als erledigt markiert');
      fetchDuties();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDeleteDuty = async (dutyId: string) => {
    if (!confirm('Arbeitsdienst wirklich löschen?')) return;
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Arbeitsdienst gelöscht');
      setExpandedId(null);
      fetchDuties();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const handleStartEdit = (duty: WorkDuty) => {
    setEditingId(duty.id);
    setEditForm({
      title: duty.title,
      description: duty.description ?? '',
      duty_type: duty.duty_type,
      scheduled_date: duty.scheduled_date ?? '',
      start_time: duty.start_time ?? '',
      end_time: duty.end_time ?? '',
      max_participants: duty.max_participants,
      priority: duty.priority,
    });
  };

  const handleSaveEdit = async (dutyId: string) => {
    try {
      const res = await apiFetch(`/api/work-duties/${dutyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Arbeitsdienst aktualisiert');
      setEditingId(null);
      fetchDuties();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleBulkCreate = async () => {
    if (!bulkTemplate.title) {
      toast.error('Titel erforderlich');
      return;
    }
    if (!bulkStartDate || !bulkEndDate) {
      toast.error('Start- und Enddatum erforderlich');
      return;
    }
    setBulkLoading(true);
    try {
      const res = await apiFetch('/api/work-duties/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: bulkTemplate,
          start_date: bulkStartDate,
          end_date: bulkEndDate,
          recurrence: bulkRecurrence,
          weekdays: bulkRecurrence === 'weekdays' ? bulkWeekdays : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      toast.success(`${data.created} Arbeitsdienste erstellt`);
      setShowBulk(false);
      resetBulkForm();
      fetchDuties();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setBulkLoading(false);
    }
  };

  const resetBulkForm = () => {
    setBulkTemplate({
      title: '',
      description: '',
      duty_type: 'court_maintenance',
      start_time: '',
      end_time: '',
      max_participants: 1,
      priority: 'medium',
      notes: '',
    });
    setBulkStartDate('');
    setBulkEndDate('');
    setBulkRecurrence('weekly');
    setBulkWeekdays([6]);
    setTemplateName('');
  };

  const saveAsTemplate = () => {
    if (!bulkTemplate.title) {
      toast.error('Bitte zuerst einen Titel eingeben');
      return;
    }
    const name = templateName.trim() || bulkTemplate.title;
    setSavedTemplates((prev) => [...prev, { ...bulkTemplate, title: name }]);
    toast.success(`Vorlage "${name}" gespeichert`);
  };

  const loadTemplate = (tpl: typeof bulkTemplate) => {
    setBulkTemplate(tpl);
    toast.success(`Vorlage "${tpl.title}" geladen`);
  };

  const toggleWeekday = (day: number) => {
    setBulkWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const weekdayLabels = [
    { value: 0, label: 'So' },
    { value: 1, label: 'Mo' },
    { value: 2, label: 'Di' },
    { value: 3, label: 'Mi' },
    { value: 4, label: 'Do' },
    { value: 5, label: 'Fr' },
    { value: 6, label: 'Sa' },
  ];

  const filteredDuties = filter === 'all' ? duties : duties.filter((d) => d.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">Laden…</div>
    );
  }

  const stats = {
    open: duties.filter((d) => d.status === 'open').length,
    assigned: duties.filter((d) => d.status === 'assigned').length,
    completed: duties.filter((d) => d.status === 'completed').length,
  };

  const filteredMembers = memberSearch.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
          m.email.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Offen', value: stats.open, color: 'text-warning-600', status: 'open' },
          {
            label: 'Zugewiesen',
            value: stats.assigned,
            color: 'text-info-600',
            status: 'assigned',
          },
          {
            label: 'Erledigt',
            value: stats.completed,
            color: 'text-success-600',
            status: 'completed',
          },
        ].map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilter(filter === s.status ? 'all' : s.status)}
          >
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'open', 'assigned', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
            >
              {f === 'all'
                ? `Alle (${duties.length})`
                : f === 'open'
                  ? `Offen (${stats.open})`
                  : f === 'assigned'
                    ? `Zugewiesen (${stats.assigned})`
                    : `Erledigt (${stats.completed})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} className="gap-1.5">
            <CalendarRange className="h-4 w-4" /> Bulk-Erstellen
          </Button>
          <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Neuer Dienst
          </Button>
        </div>
      </div>

      {/* Duty List */}
      {filteredDuties.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <HardHat className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">
            {filter === 'all'
              ? 'Keine Arbeitsdienste vorhanden'
              : `Keine ${statusConfig[filter]?.label ?? ''} Dienste`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDuties.map((duty) => {
            const typeInfo = dutyTypeLabels[duty.duty_type] ?? dutyTypeLabels.other;
            const statInfo = statusConfig[duty.status] ?? statusConfig.open;
            const assignedCount = duty.work_duty_assignments?.length ?? 0;
            const TypeIcon = typeInfo.icon;
            const StatIcon = statInfo.icon;
            const isExpanded = expandedId === duty.id;

            return (
              <Card key={duty.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Main Row — Clickable */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(isExpanded ? null : duty.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : duty.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{duty.title}</h3>
                        {duty.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{duty.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={`${typeInfo.color} text-xs`}>{typeInfo.label}</Badge>
                          <Badge className={`${statInfo.color} text-xs gap-1`}>
                            <StatIcon className="h-3 w-3" />
                            {statInfo.label}
                          </Badge>
                          <Badge className={`${priorityColors[duty.priority] ?? ''} text-xs`}>
                            {duty.priority === 'high'
                              ? 'Hoch'
                              : duty.priority === 'low'
                                ? 'Niedrig'
                                : 'Mittel'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0 ml-4">
                      {duty.scheduled_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(duty.scheduled_date).toLocaleDateString('de-DE')}
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
                        {assignedCount}/{duty.max_participants}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      {/* Assigned Members */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Zugewiesene Mitglieder
                          </h4>
                          {duty.status !== 'completed' && duty.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssigningId(assigningId === duty.id ? null : duty.id);
                              }}
                            >
                              <UserPlus className="h-3 w-3" /> Zuweisen
                            </Button>
                          )}
                        </div>

                        {assignedCount === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Noch keine Mitglieder zugewiesen
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {duty.work_duty_assignments.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm"
                              >
                                <span className="font-medium">{a.name ?? a.member_id}</span>
                                {a.status === 'completed' && (
                                  <CheckCircle2 className="h-3 w-3 text-success-600" />
                                )}
                                {duty.status !== 'completed' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveAssignment(duty.id, a.id);
                                    }}
                                    className="text-muted-foreground hover:text-error-500 transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Member Assignment Search */}
                        {assigningId === duty.id && (
                          <div className="mt-2 p-3 border rounded-lg bg-muted/50 space-y-2">
                            <div className="relative">
                              <Input
                                placeholder="Mitglied suchen…"
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                className="pr-8"
                              />
                              {memberSearch && (
                                <button
                                  onClick={() => setMemberSearch('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            {memberSearch.trim() && (
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {filteredMembers.length === 0 ? (
                                  <p className="text-xs text-muted-foreground py-2 text-center">
                                    Keine Ergebnisse
                                  </p>
                                ) : (
                                  filteredMembers.slice(0, 10).map((m) => {
                                    const alreadyAssigned = duty.work_duty_assignments.some(
                                      (a) => a.member_id === m.id
                                    );
                                    return (
                                      <button
                                        key={m.id}
                                        onClick={() =>
                                          !alreadyAssigned && handleAssignMember(duty.id, m.id)
                                        }
                                        disabled={alreadyAssigned}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center justify-between ${
                                          alreadyAssigned
                                            ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                                            : 'hover:bg-background cursor-pointer'
                                        }`}
                                      >
                                        <span>
                                          {m.name}{' '}
                                          <span className="text-muted-foreground">({m.email})</span>
                                        </span>
                                        {alreadyAssigned && (
                                          <Badge variant="secondary" className="text-2xs">
                                            Bereits zugewiesen
                                          </Badge>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t">
                        {duty.status === 'open' || duty.status === 'assigned' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleCompleteDuty(duty.id)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Als erledigt markieren
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleStartEdit(duty)}
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Bearbeiten
                        </Button>
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-error-600 hover:text-error-700 hover:bg-error-50 gap-1.5"
                          onClick={() => handleDeleteDuty(duty.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Löschen
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Duty Form */}
      {editingId && (
        <Card className="border-2 border-brand-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Arbeitsdienst bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="edit-duty-title" className="text-xs font-medium">
                Titel *
              </label>
              <Input
                id="edit-duty-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-duty-type" className="text-xs font-medium">
                  Art
                </label>
                <select
                  id="edit-duty-type"
                  value={editForm.duty_type}
                  onChange={(e) => setEditForm({ ...editForm, duty_type: e.target.value })}
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  {Object.entries(dutyTypeLabels).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-duty-priority" className="text-xs font-medium">
                  Priorität
                </label>
                <select
                  id="edit-duty-priority"
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="edit-duty-date" className="text-xs font-medium">
                  Datum
                </label>
                <Input
                  id="edit-duty-date"
                  type="date"
                  value={editForm.scheduled_date}
                  onChange={(e) => setEditForm({ ...editForm, scheduled_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="edit-duty-start" className="text-xs font-medium">
                  Von
                </label>
                <Input
                  id="edit-duty-start"
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="edit-duty-end" className="text-xs font-medium">
                  Bis
                </label>
                <Input
                  id="edit-duty-end"
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-duty-max" className="text-xs font-medium">
                Max. Teilnehmer
              </label>
              <Input
                id="edit-duty-max"
                type="number"
                min={1}
                value={editForm.max_participants}
                onChange={(e) =>
                  setEditForm({ ...editForm, max_participants: parseInt(e.target.value) || 1 })
                }
                className="mt-1 w-32"
              />
            </div>
            <Input
              placeholder="Beschreibung (optional)"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={() => handleSaveEdit(editingId)}>
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Create Dialog */}
      {showBulk && (
        <Card className="border-2 border-brand-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="h-4 w-4 text-brand-primary" />
                Mehrere Dienste erstellen
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowBulk(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Erstelle wiederkehrende Dienste aus einer Vorlage für einen Zeitraum.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Saved templates */}
            {savedTemplates.length > 0 && (
              <div>
                <span className="text-xs font-medium mb-2 block">Gespeicherte Vorlagen</span>
                <div className="flex flex-wrap gap-2">
                  {savedTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => loadTemplate(tpl)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Template fields */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Vorlage
              </span>
              <div>
                <label htmlFor="bulk-title" className="text-xs font-medium">
                  Titel *
                </label>
                <Input
                  id="bulk-title"
                  value={bulkTemplate.title}
                  onChange={(e) => setBulkTemplate({ ...bulkTemplate, title: e.target.value })}
                  placeholder="z.B. Platzpflege"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bulk-type" className="text-xs font-medium">
                    Art
                  </label>
                  <select
                    id="bulk-type"
                    value={bulkTemplate.duty_type}
                    onChange={(e) =>
                      setBulkTemplate({ ...bulkTemplate, duty_type: e.target.value })
                    }
                    className="w-full mt-1 p-2 rounded border bg-background text-sm"
                  >
                    {Object.entries(dutyTypeLabels).map(([key, v]) => (
                      <option key={key} value={key}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bulk-priority" className="text-xs font-medium">
                    Priorität
                  </label>
                  <select
                    id="bulk-priority"
                    value={bulkTemplate.priority}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, priority: e.target.value })}
                    className="w-full mt-1 p-2 rounded border bg-background text-sm"
                  >
                    <option value="low">Niedrig</option>
                    <option value="medium">Mittel</option>
                    <option value="high">Hoch</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="bulk-start" className="text-xs font-medium">
                    Von
                  </label>
                  <Input
                    id="bulk-start"
                    type="time"
                    value={bulkTemplate.start_time}
                    onChange={(e) =>
                      setBulkTemplate({ ...bulkTemplate, start_time: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-end" className="text-xs font-medium">
                    Bis
                  </label>
                  <Input
                    id="bulk-end"
                    type="time"
                    value={bulkTemplate.end_time}
                    onChange={(e) => setBulkTemplate({ ...bulkTemplate, end_time: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-max" className="text-xs font-medium">
                    Max. TN
                  </label>
                  <Input
                    id="bulk-max"
                    type="number"
                    min={1}
                    value={bulkTemplate.max_participants}
                    onChange={(e) =>
                      setBulkTemplate({
                        ...bulkTemplate,
                        max_participants: parseInt(e.target.value) || 1,
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
              <Input
                placeholder="Beschreibung (optional)"
                value={bulkTemplate.description}
                onChange={(e) => setBulkTemplate({ ...bulkTemplate, description: e.target.value })}
              />
            </div>

            {/* Date range */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Zeitraum & Wiederholung
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bulk-from" className="text-xs font-medium">
                    Von *
                  </label>
                  <Input
                    id="bulk-from"
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-to" className="text-xs font-medium">
                    Bis *
                  </label>
                  <Input
                    id="bulk-to"
                    type="date"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <span className="text-xs font-medium">Rhythmus</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { value: 'daily', label: 'Täglich' },
                    { value: 'weekly', label: 'Wöchentlich' },
                    { value: 'biweekly', label: 'Alle 2 Wochen' },
                    { value: 'monthly', label: 'Monatlich' },
                    { value: 'weekdays', label: 'Bestimmte Wochentage' },
                  ].map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setBulkRecurrence(r.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        bulkRecurrence === r.value
                          ? 'bg-gray-900 text-white'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              {bulkRecurrence === 'weekdays' && (
                <div>
                  <span className="text-xs font-medium">Wochentage wählen</span>
                  <div className="flex gap-2 mt-2">
                    {weekdayLabels.map((wd) => (
                      <button
                        key={wd.value}
                        onClick={() => toggleWeekday(wd.value)}
                        className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${
                          bulkWeekdays.includes(wd.value)
                            ? 'bg-brand-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {wd.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Template save */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Vorlagenname (optional)"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={saveAsTemplate}
                className="gap-1.5 shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Als Vorlage speichern
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowBulk(false);
                  resetBulkForm();
                }}
              >
                Abbrechen
              </Button>
              <Button
                size="sm"
                onClick={handleBulkCreate}
                disabled={bulkLoading}
                className="gap-1.5"
              >
                {bulkLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarRange className="h-3.5 w-3.5" />
                )}
                {bulkLoading ? 'Erstelle…' : 'Dienste erstellen'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Duty Form */}
      {showNew && (
        <Card className="border-2 border-brand-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Neuen Arbeitsdienst anlegen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label htmlFor="new-duty-title" className="text-xs font-medium">
                Titel *
              </label>
              <Input
                id="new-duty-title"
                value={newDuty.title}
                onChange={(e) => setNewDuty({ ...newDuty, title: e.target.value })}
                placeholder="z.B. Platzpflege Samstag"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-duty-type" className="text-xs font-medium">
                  Art
                </label>
                <select
                  id="new-duty-type"
                  value={newDuty.duty_type}
                  onChange={(e) => setNewDuty({ ...newDuty, duty_type: e.target.value })}
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  {Object.entries(dutyTypeLabels).map(([key, v]) => (
                    <option key={key} value={key}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-duty-priority" className="text-xs font-medium">
                  Priorität
                </label>
                <select
                  id="new-duty-priority"
                  value={newDuty.priority}
                  onChange={(e) => setNewDuty({ ...newDuty, priority: e.target.value })}
                  className="w-full mt-1 p-2 rounded border bg-background text-sm"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="new-duty-date" className="text-xs font-medium">
                  Datum
                </label>
                <Input
                  id="new-duty-date"
                  type="date"
                  value={newDuty.scheduled_date}
                  onChange={(e) => setNewDuty({ ...newDuty, scheduled_date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="new-duty-start" className="text-xs font-medium">
                  Von
                </label>
                <Input
                  id="new-duty-start"
                  type="time"
                  value={newDuty.start_time}
                  onChange={(e) => setNewDuty({ ...newDuty, start_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="new-duty-end" className="text-xs font-medium">
                  Bis
                </label>
                <Input
                  id="new-duty-end"
                  type="time"
                  value={newDuty.end_time}
                  onChange={(e) => setNewDuty({ ...newDuty, end_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <label htmlFor="new-duty-max" className="text-xs font-medium">
                Max. Teilnehmer
              </label>
              <Input
                id="new-duty-max"
                type="number"
                min={1}
                value={newDuty.max_participants}
                onChange={(e) =>
                  setNewDuty({ ...newDuty, max_participants: parseInt(e.target.value) || 1 })
                }
                className="mt-1 w-32"
              />
            </div>
            <Input
              placeholder="Beschreibung (optional)"
              value={newDuty.description}
              onChange={(e) => setNewDuty({ ...newDuty, description: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>
                Abbrechen
              </Button>
              <Button size="sm" onClick={handleCreate}>
                Erstellen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
