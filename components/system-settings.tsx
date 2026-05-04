'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Plus,
  Edit,
  XCircle,
  Download,
  Shield,
  Mail,
  Bell,
  Globe,
  Eye,
  EyeOff,
  Search,
  Filter,
  Database,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';

export interface SystemSetting {
  id: string;
  category: 'general' | 'email' | 'notifications' | 'security' | 'integrations' | 'other';
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  isPublic: boolean;
  isRequired: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
  updatedAt: string;
  updatedBy?: string;
}

export default function SystemSettingsManagement() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editForm, setEditForm] = useState<Partial<SystemSetting>>({});
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'general' | 'email' | 'notifications' | 'security' | 'integrations' | 'other'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Failed to load system settings');
      }
      const data = await response.json();
      setSettings(data.systemSettings || []);
    } catch (error) {
      console.error('Failed to load system settings:', error);
      toast.error('Fehler beim Laden der Systemeinstellungen');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSetting = async () => {
    try {
      const response = await fetch('/api/system-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create system setting');
      }

      const data = await response.json();
      setSettings([...settings, data.systemSetting]);
      setEditForm({});
      toast.success('Systemeinstellung erfolgreich erstellt');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Fehler beim Erstellen der Systemeinstellung'
      );
      console.error('Create error:', error);
    }
  };

  const handleDeleteSetting = async (id: string) => {
    if (!confirm('Möchten Sie diese Systemeinstellung wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`/api/system-settings/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete system setting');
      }

      setSettings(settings.filter((s) => s.id !== id));
      toast.success('Systemeinstellung erfolgreich gelöscht');
    } catch (error) {
      toast.error('Fehler beim Löschen der Systemeinstellung');
      console.error('Delete error:', error);
    }
  };

  const getCategoryIcon = (category: SystemSetting['category']) => {
    switch (category) {
      case 'general':
        return <Settings className="h-5 w-5" />;
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'notifications':
        return <Bell className="h-5 w-5" />;
      case 'security':
        return <Shield className="h-5 w-5" />;
      case 'integrations':
        return <Globe className="h-5 w-5" />;
      default:
        return <Database className="h-5 w-5" />;
    }
  };

  const getCategoryLabel = (category: SystemSetting['category']) => {
    switch (category) {
      case 'general':
        return 'Allgemein';
      case 'email':
        return 'E-Mail';
      case 'notifications':
        return 'Benachrichtigungen';
      case 'security':
        return 'Sicherheit';
      case 'integrations':
        return 'Integrationen';
      default:
        return 'Sonstiges';
    }
  };

  const getTypeColor = (type: SystemSetting['type']) => {
    switch (type) {
      case 'string':
        return 'bg-blue-100 text-blue-700';
      case 'number':
        return 'bg-green-100 text-green-700';
      case 'boolean':
        return 'bg-purple-100 text-purple-700';
      case 'json':
        return 'bg-orange-100 text-orange-700';
      case 'array':
        return 'bg-red-100 text-red-700';
    }
  };

  const getTypeLabel = (type: SystemSetting['type']) => {
    switch (type) {
      case 'string':
        return 'Text';
      case 'number':
        return 'Zahl';
      case 'boolean':
        return 'Boolean';
      case 'json':
        return 'JSON';
      case 'array':
        return 'Array';
    }
  };

  const filteredSettings = settings.filter((setting) => {
    const matchesCategory = selectedCategory === 'all' || setting.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      `${setting.key} ${setting.description || ''}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-gray-500">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">System-Einstellungen</h1>
          <p className="text-gray-500">Verwaltung aller Systemkonfigurationen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Suche nach Schlüssel oder Beschreibung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="all">Alle Kategorien</option>
            <option value="general">Allgemein</option>
            <option value="email">E-Mail</option>
            <option value="notifications">Benachrichtigungen</option>
            <option value="security">Sicherheit</option>
            <option value="integrations">Integrationen</option>
            <option value="other">Sonstiges</option>
          </select>
        </div>
      </div>

      {/* Create New Setting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Systemeinstellung erstellen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Kategorie</Label>
              <select
                value={editForm.category || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    category: e.target.value as
                      | 'general'
                      | 'email'
                      | 'notifications'
                      | 'security'
                      | 'integrations'
                      | 'other',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Bitte auswählen...</option>
                <option value="general">Allgemein</option>
                <option value="email">E-Mail</option>
                <option value="notifications">Benachrichtigungen</option>
                <option value="security">Sicherheit</option>
                <option value="integrations">Integrationen</option>
                <option value="other">Sonstiges</option>
              </select>
            </div>
            <div>
              <Label>Schlüssel</Label>
              <Input
                value={editForm.key || ''}
                onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                placeholder="z.B. club_name"
              />
            </div>
            <div>
              <Label>Typ</Label>
              <select
                value={editForm.type || ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    type: e.target.value as 'string' | 'number' | 'boolean' | 'json' | 'array',
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                <option value="">Bitte auswählen...</option>
                <option value="string">Text</option>
                <option value="number">Zahl</option>
                <option value="boolean">Boolean</option>
                <option value="json">JSON</option>
                <option value="array">Array</option>
              </select>
            </div>
            <div>
              <Label>Wert</Label>
              <Input
                value={editForm.value || ''}
                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                placeholder="Wert der Einstellung"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Beschreibung</Label>
              <Input
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Beschreibung der Einstellung"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={editForm.isPublic || false}
                  onChange={(e) => setEditForm({ ...editForm, isPublic: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isPublic" className="text-sm">
                  Öffentlich
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={editForm.isRequired || false}
                  onChange={(e) => setEditForm({ ...editForm, isRequired: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isRequired" className="text-sm">
                  Erforderlich
                </Label>
              </div>
            </div>
          </div>
          <Button onClick={handleCreateSetting} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Systemeinstellung erstellen
          </Button>
        </CardContent>
      </Card>

      {/* Settings List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Systemeinstellungen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSettings.map((setting) => (
            <Card key={setting.id}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand-primary/10 rounded-lg">
                        {getCategoryIcon(setting.category)}
                      </div>
                      <div>
                        <div className="font-semibold">{setting.key}</div>
                        <div className="text-sm text-gray-600">
                          {getCategoryLabel(setting.category)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge className={getTypeColor(setting.type)}>
                        {getTypeLabel(setting.type)}
                      </Badge>
                      {setting.isRequired && (
                        <Badge variant="outline" className="bg-red-100 text-red-700">
                          <Key className="h-3 w-3" />
                          Erforderlich
                        </Badge>
                      )}
                    </div>
                  </div>

                  {setting.description && (
                    <div className="text-sm text-gray-600">{setting.description}</div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Wert:</span>
                      <span className="font-medium">{setting.value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {setting.isPublic ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditForm(setting);
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteSetting(setting.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Löschen
                    </Button>
                  </div>

                  <div className="text-xs text-gray-500 pt-2 border-t">
                    Zuletzt aktualisiert:{' '}
                    {format(parseISO(setting.updatedAt), 'dd. MMM yyyy HH:mm', { locale: de })}
                    {setting.updatedBy && ` von ${setting.updatedBy}`}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
