'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Settings,
  Check,
  X,
  Loader2,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  WIDGET_REGISTRY,
  getDefaultLayout,
  getAvailableWidgets,
  SIZE_GRID_CLASSES,
  type DashboardLayout,
  type DashboardWidget,
  type WidgetSize,
} from '@/lib/dashboard-widgets';
import { apiFetch } from '@/lib/api-fetch';

// ─── Sortable Widget Wrapper ───

function SortableWidget({
  widget,
  isEditing,
  onToggleVisibility,
  onRemove,
  onResize,
  children,
}: {
  widget: DashboardWidget;
  isEditing: boolean;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const sizeOptions: WidgetSize[] = ['sm', 'md', 'lg', 'full'];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${SIZE_GRID_CLASSES[widget.size]} relative group ${
        isDragging ? 'z-50' : ''
      } ${!widget.visible && isEditing ? 'opacity-40' : ''}`}
    >
      {/* Edit toolbar overlay */}
      {isEditing && (
        <div className="absolute -top-2 -right-2 z-20 flex items-center gap-1 bg-background dark:bg-card border border-border dark:border-white/10 rounded-xl shadow-lg px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1 rounded-xl hover:bg-muted dark:hover:bg-background/10 text-muted-foreground cursor-grab active:cursor-grabbing"
            aria-label="Widget verschieben"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {/* Size cycle */}
          <button
            onClick={() => {
              const currentIdx = sizeOptions.indexOf(widget.size);
              const nextSize = sizeOptions[(currentIdx + 1) % sizeOptions.length];
              onResize(widget.id, nextSize);
            }}
            className="px-1.5 py-1 rounded-xl hover:bg-muted dark:hover:bg-background/10 text-xs font-mono text-muted-foreground"
            title={`Größe: ${widget.size} → ${sizeOptions[(sizeOptions.indexOf(widget.size) + 1) % sizeOptions.length]}`}
          >
            {widget.size.toUpperCase()}
          </button>

          {/* Toggle visibility */}
          <button
            onClick={() => onToggleVisibility(widget.id)}
            className="p-1 rounded-xl hover:bg-muted dark:hover:bg-background/10 text-muted-foreground"
            aria-label={widget.visible ? 'Widget ausblenden' : 'Widget einblenden'}
          >
            {widget.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>

          {/* Remove */}
          <button
            onClick={() => onRemove(widget.id)}
            className="p-1 rounded-xl hover:bg-error-50 dark:hover:bg-error-900/20 text-error-400 hover:text-error-600"
            aria-label="Widget entfernen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Widget content */}
      {widget.visible || isEditing ? children : null}
    </div>
  );
}

// ─── Widget Picker Modal ───

function WidgetPicker({
  availableWidgets,
  onAdd,
  onClose,
}: {
  availableWidgets: Array<{
    type: string;
    label: string;
    description: string;
    icon: React.ElementType;
  }>;
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  if (availableWidgets.length === 0) {
    return (
      <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-background dark:bg-card border border-border dark:border-white/10 rounded-xl shadow-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Alle verfügbaren Widgets sind bereits hinzugefügt.
        </p>
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-3">
          Schließen
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-2 z-30 w-80 bg-background dark:bg-card border border-border dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border dark:border-white/10 bg-muted/30">
        <h3 className="text-sm font-semibold">Widget hinzufügen</h3>
      </div>
      <div className="p-2 max-h-64 overflow-y-auto">
        {availableWidgets.map((w) => {
          const Icon = w.icon;
          return (
            <button
              key={w.type}
              onClick={() => {
                onAdd(w.type);
                onClose();
              }}
              className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 dark:hover:bg-background/5 transition-colors text-left"
            >
              <div className="shrink-0 h-9 w-9 rounded-xl bg-brand-light/10 text-brand-light flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground dark:text-white">{w.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{w.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───

interface CustomizableDashboardProps {
  dashboardType: 'superadmin' | 'club';
  clubId?: string;
  renderWidget: (widget: DashboardWidget) => React.ReactNode;
  className?: string;
}

export function CustomizableDashboard({
  dashboardType,
  clubId,
  renderWidget,
  className = '',
}: CustomizableDashboardProps) {
  const [layout, setLayout] = useState<DashboardLayout>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load preferences from API
  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ dashboardType });
      if (clubId) params.set('clubId', clubId);
      const res = await apiFetch(`/api/dashboard/preferences?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLayout(data.layout ?? getDefaultLayout(dashboardType));
      } else {
        setLayout(getDefaultLayout(dashboardType));
      }
    } catch {
      setLayout(getDefaultLayout(dashboardType));
    } finally {
      setIsLoading(false);
    }
  }, [dashboardType, clubId]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Save preferences to API
  const savePreferences = useCallback(
    async (newLayout: DashboardLayout) => {
      setIsSaving(true);
      setSaveStatus('idle');
      try {
        const res = await apiFetch('/api/dashboard/preferences', {
          method: 'PUT',
          body: JSON.stringify({ dashboardType, clubId, layout: newLayout }),
        });
        if (res.ok) {
          setSaveStatus('saved');
          setHasChanges(false);
          setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
      }
    },
    [dashboardType, clubId]
  );

  // DnD handlers
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLayout((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const newIndex = prev.findIndex((w) => w.id === over.id);
      const newLayout = arrayMove(prev, oldIndex, newIndex).map((w, i) => ({ ...w, order: i }));
      setHasChanges(true);
      return newLayout;
    });
  };

  // Widget management
  const handleToggleVisibility = (id: string) => {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
    setHasChanges(true);
  };

  const handleRemove = (id: string) => {
    setLayout((prev) => prev.filter((w) => w.id !== id));
    setHasChanges(true);
  };

  const handleResize = (id: string, size: WidgetSize) => {
    setLayout((prev) => prev.map((w) => (w.id === id ? { ...w, size } : w)));
    setHasChanges(true);
  };

  const handleAddWidget = (type: string) => {
    const def = WIDGET_REGISTRY[type];
    if (!def) return;
    const newWidget: DashboardWidget = {
      id: `${type}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      visible: true,
      order: layout.length,
      size: def.defaultSize,
    };
    setLayout((prev) => [...prev, newWidget]);
    setHasChanges(true);
  };

  const handleReset = () => {
    setLayout(getDefaultLayout(dashboardType));
    setHasChanges(true);
  };

  const availableWidgets = getAvailableWidgets(dashboardType, layout);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* ── Edit Mode Toolbar ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {isEditing && (
            <span className="text-xs font-medium text-brand-light bg-brand-light/10 px-2.5 py-1 rounded-full">
              Bearbeitungsmodus
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              {/* Add widget */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPicker(!showPicker)}
                  disabled={availableWidgets.length === 0}
                  className="text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Widget hinzufügen
                </Button>
                {showPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowPicker(false)}
                      onKeyDown={(e) => e.key === 'Escape' && setShowPicker(false)}
                      role="button"
                      tabIndex={-1}
                      aria-label="Schließen"
                    />
                    <WidgetPicker
                      availableWidgets={availableWidgets}
                      onAdd={handleAddWidget}
                      onClose={() => setShowPicker(false)}
                    />
                  </>
                )}
              </div>

              {/* Reset to defaults */}
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Zurücksetzen
              </Button>

              {/* Save */}
              <Button
                variant="default"
                size="sm"
                onClick={() => savePreferences(layout)}
                disabled={!hasChanges || isSaving}
                className="text-xs bg-brand-primary hover:bg-brand-dark text-white"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : saveStatus === 'saved' ? (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                ) : null}
                {saveStatus === 'saved' ? 'Gespeichert' : 'Speichern'}
              </Button>
            </>
          )}

          {/* Toggle edit mode */}
          <Button
            variant={isEditing ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => {
              if (isEditing && hasChanges) {
                // Revert unsaved changes
                loadPreferences();
              }
              setIsEditing(!isEditing);
              setShowPicker(false);
            }}
            className="text-xs"
          >
            {isEditing ? (
              <>
                <X className="h-3.5 w-3.5 mr-1.5" />
                Abbrechen
              </>
            ) : (
              <>
                <Settings className="h-3.5 w-3.5 mr-1.5" />
                Dashboard anpassen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Widget Grid ── */}
      {isEditing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={layout.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {layout.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  isEditing={isEditing}
                  onToggleVisibility={handleToggleVisibility}
                  onRemove={handleRemove}
                  onResize={handleResize}
                >
                  {renderWidget(widget)}
                </SortableWidget>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {layout
            .filter((w) => w.visible)
            .sort((a, b) => a.order - b.order)
            .map((widget) => (
              <div key={widget.id} className={SIZE_GRID_CLASSES[widget.size]}>
                {renderWidget(widget)}
              </div>
            ))}
        </div>
      )}

      {/* Empty state */}
      {layout.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-xl bg-muted dark:bg-card/5 flex items-center justify-center mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-medium text-muted-foreground mb-2">Dashboard ist leer</p>
          <p className="text-sm text-muted-foreground mb-4">
            Klicke auf &quot;Dashboard anpassen&quot; um Widgets hinzuzufügen
          </p>
        </div>
      )}

      {/* Error toast */}
      {saveStatus === 'error' && (
        <div className="fixed bottom-6 right-6 z-50 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-error-700 dark:text-error-300 px-4 py-3 rounded-xl shadow-lg text-sm">
          Fehler beim Speichern. Bitte erneut versuchen.
        </div>
      )}
    </div>
  );
}
