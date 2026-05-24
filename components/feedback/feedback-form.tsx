'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StarRating from './star-rating';
import { toast } from 'sonner';

interface FeedbackFormProps {
  trainerId: string;
  sessionId?: string;
  trainerName?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function FeedbackForm({
  trainerId,
  sessionId,
  trainerName,
  onSuccess,
  onCancel,
}: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Please select a rating before submitting');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trainer_id: trainerId,
          session_id: sessionId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit feedback');
      }

      toast.success('Thank you for your feedback!');

      // Reset form
      setRating(0);
      setComment('');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {trainerName && (
        <div className="text-sm text-gray-600">
          Rate your experience with <span className="font-medium">{trainerName}</span>
        </div>
      )}

      <div className="space-y-2">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="block text-sm font-medium text-gray-700">Your Rating *</label>
        <StarRating rating={rating} onRatingChange={setRating} size="lg" />
      </div>

      <div className="space-y-2">
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
          Comment (Optional)
        </label>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts about the session or trainer..."
          rows={4}
          maxLength={1000}
          className="resize-none"
        />
        <div className="text-xs text-gray-500 text-right">{comment.length}/1000 characters</div>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || rating === 0}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </form>
  );
}
