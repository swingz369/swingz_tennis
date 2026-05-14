'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FeedbackForm from './feedback-form';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainerId: string;
  trainerName: string;
  sessionId?: string;
  sessionTitle?: string;
}

export default function FeedbackModal({
  open,
  onOpenChange,
  trainerId,
  trainerName,
  sessionId,
  sessionTitle,
}: FeedbackModalProps) {
  const handleSuccess = () => {
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share Your Feedback</DialogTitle>
          <DialogDescription>
            {sessionTitle
              ? `How was your experience in "${sessionTitle}"?`
              : `Rate your experience with ${trainerName}`}
          </DialogDescription>
        </DialogHeader>

        <FeedbackForm
          trainerId={trainerId}
          trainerName={trainerName}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
          {...(sessionId ? { sessionId } : {})}
        />
      </DialogContent>
    </Dialog>
  );
}
