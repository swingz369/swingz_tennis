'use client';

import { useEffect, useState } from 'react';
import StarRating from './star-rating';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, MessageSquare, User } from 'lucide-react';

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  is_visible: boolean;
  is_flagged: boolean;
  created_at: string;
  member?: {
    id: string;
  };
  session?: {
    id: string;
  };
}

interface FeedbackListProps {
  trainerId?: string;
  limit?: number;
  visibleOnly?: boolean;
  showMemberInfo?: boolean;
  showSessionInfo?: boolean;
}

export default function FeedbackList({
  trainerId,
  limit = 20,
  visibleOnly = true,
  showMemberInfo = true,
  showSessionInfo = true,
}: FeedbackListProps) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    averageRating: number;
    totalFeedback: number;
  } | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, [trainerId, limit, visibleOnly]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let url = trainerId
        ? `/api/trainers/${trainerId}/feedback?limit=${limit}`
        : `/api/feedback?limit=${limit}`;

      if (!visibleOnly) {
        url += `&visibleOnly=false`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await response.json();
      setFeedback(data.feedback || []);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      setError('Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500">No feedback yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-3xl font-bold">{stats.averageRating.toFixed(1)}</div>
                <div className="text-sm text-gray-500">Average Rating</div>
              </div>
              <div className="flex-1">
                <StarRating
                  rating={stats.averageRating}
                  readonly
                  size="lg"
                  showCount
                  count={stats.totalFeedback}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {feedback.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {showMemberInfo && item.member && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">Member</span>
                    </div>
                  )}
                  <StarRating rating={item.rating} readonly size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  {!item.is_visible && <Badge variant="outline">Hidden</Badge>}
                  {item.is_flagged && <Badge variant="error">Flagged</Badge>}
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {item.comment && <p className="text-sm text-gray-700 mb-3">{item.comment}</p>}

              {showSessionInfo && item.session && (
                <div className="text-xs text-gray-500">Session ID: {item.session.id}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
