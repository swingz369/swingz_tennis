'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import StarRating from '@/components/feedback/star-rating';
import { Eye, EyeOff, Flag, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  is_visible: boolean;
  is_flagged: boolean;
  flagged_reason: string | null;
  created_at: string;
  trainer_id: string;
  member_id: string;
  session_id: string | null;
}

interface FeedbackModerationProps {
  clubId?: string;
}

export function FeedbackModerationPanel({ clubId }: FeedbackModerationProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVisible, setFilterVisible] = useState<'all' | 'visible' | 'hidden'>('all');
  const [filterFlagged, setFilterFlagged] = useState<'all' | 'flagged' | 'clean'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, [clubId]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/feedback?limit=100&visibleOnly=false`);
      if (!response.ok) throw new Error('Failed to fetch feedback');

      const data = await response.json();
      setFeedback(data.feedback || []);
    } catch (_error) {
      console.error('Error fetching feedback:', _error);
      toast.error('Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisibilityToggle = async (id: string, currentVisibility: boolean) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_visible: !currentVisibility }),
      });

      if (!response.ok) throw new Error('Failed to update visibility');

      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_visible: !currentVisibility } : f))
      );

      toast.success(`Feedback ${!currentVisibility ? 'shown' : 'hidden'}`);
    } catch (_error) {
      toast.error('Failed to update feedback');
    }
  };

  const handleFlagToggle = async (id: string, currentFlagged: boolean, reason?: string) => {
    try {
      const response = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_flagged: !currentFlagged,
          flagged_reason: !currentFlagged ? reason || 'Inappropriate content' : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to flag feedback');

      setFeedback((prev) =>
        prev.map((f) => (f.id === id ? { ...f, is_flagged: !currentFlagged } : f))
      );

      toast.success(`Feedback ${!currentFlagged ? 'flagged' : 'unflagged'}`);
    } catch (_error) {
      toast.error('Failed to flag feedback');
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    try {
      const response = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete feedback');
      setFeedback((prev) => prev.filter((f) => f.id !== id));
      toast.success('Feedback deleted');
    } catch (_error) {
      toast.error('Failed to delete feedback');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleBulkAction = async (action: 'show' | 'hide' | 'delete') => {
    if (selectedIds.size === 0) {
      toast.error('No feedback selected');
      return;
    }

    if (action === 'delete') {
      setBulkDeleteConfirmOpen(true);
      return;
    }

    await executeBulkAction(action);
  };

  const executeBulkAction = async (action: 'show' | 'hide' | 'delete') => {
    try {
      const promises = Array.from(selectedIds).map((id) => {
        if (action === 'delete') {
          return fetch(`/api/feedback/${id}`, { method: 'DELETE' });
        } else {
          return fetch(`/api/feedback/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_visible: action === 'show' }),
          });
        }
      });

      await Promise.all(promises);

      if (action === 'delete') {
        setFeedback((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      } else {
        setFeedback((prev) =>
          prev.map((f) => (selectedIds.has(f.id) ? { ...f, is_visible: action === 'show' } : f))
        );
      }

      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} feedback items updated`);
    } catch (_error) {
      toast.error('Failed to perform bulk action');
    }
  };

  const confirmBulkDelete = async () => {
    await executeBulkAction('delete');
    setBulkDeleteConfirmOpen(false);
  };

  const filteredFeedback = feedback.filter((f) => {
    if (filterVisible === 'visible' && !f.is_visible) return false;
    if (filterVisible === 'hidden' && f.is_visible) return false;
    if (filterFlagged === 'flagged' && !f.is_flagged) return false;
    if (filterFlagged === 'clean' && f.is_flagged) return false;
    if (searchTerm && !f.comment?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: feedback.length,
    visible: feedback.filter((f) => f.is_visible).length,
    hidden: feedback.filter((f) => !f.is_visible).length,
    flagged: feedback.filter((f) => f.is_flagged).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-brand-primary">Feedback Moderation</h2>
        <p className="text-gray-500">Review and moderate trainer feedback</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="bordered">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Feedback</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.visible}</div>
            <div className="text-xs text-gray-500">Visible</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{stats.hidden}</div>
            <div className="text-xs text-gray-500">Hidden</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.flagged}</div>
            <div className="text-xs text-gray-500">Flagged</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card variant="bordered">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search feedback comments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select
                value={filterVisible}
                onValueChange={(v) => setFilterVisible(v as typeof filterVisible)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="visible">Visible Only</SelectItem>
                  <SelectItem value="hidden">Hidden Only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterFlagged}
                onValueChange={(v) => setFilterFlagged(v as typeof filterFlagged)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All Flags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Flags</SelectItem>
                  <SelectItem value="flagged">Flagged Only</SelectItem>
                  <SelectItem value="clean">Not Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('show')}>
                  <Eye className="h-4 w-4 mr-1" />
                  Show
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('hide')}>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card variant="bordered">
            <CardContent className="p-8 text-center text-gray-500">Loading feedback...</CardContent>
          </Card>
        ) : filteredFeedback.length === 0 ? (
          <Card variant="bordered">
            <CardContent className="p-8 text-center text-gray-500">No feedback found</CardContent>
          </Card>
        ) : (
          filteredFeedback.map((item) => (
            <Card
              key={item.id}
              variant="bordered"
              className={item.is_flagged ? 'border-red-300' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedIds);
                      if (e.target.checked) {
                        newSelected.add(item.id);
                      } else {
                        newSelected.delete(item.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                    className="mt-1"
                  />

                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StarRating rating={item.rating} readonly size="sm" />
                        <Badge variant={item.is_visible ? 'success' : 'default'}>
                          {item.is_visible ? 'Visible' : 'Hidden'}
                        </Badge>
                        {item.is_flagged && (
                          <Badge variant="error">
                            <Flag className="h-3 w-3 mr-1" />
                            Flagged
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {item.comment && <p className="text-sm text-gray-700">{item.comment}</p>}

                    {item.is_flagged && item.flagged_reason && (
                      <div className="p-2 bg-red-50 rounded text-sm text-red-700">
                        <strong>Reason:</strong> {item.flagged_reason}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVisibilityToggle(item.id, item.is_visible)}
                      >
                        {item.is_visible ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            Show
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFlagToggle(item.id, item.is_flagged)}
                      >
                        <Flag className="h-4 w-4 mr-1" />
                        {item.is_flagged ? 'Unflag' : 'Flag'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Feedback löschen"
        description="Möchten Sie dieses Feedback wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="danger"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title={`${selectedIds.size} Feedback-Einträge löschen`}
        description={`Möchten Sie wirklich ${selectedIds.size} Feedback-Einträge löschen?`}
        confirmLabel="Alle löschen"
        variant="danger"
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
