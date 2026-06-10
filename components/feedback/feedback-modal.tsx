'use client';

import { CenteredModal } from '@/components/ui/centered-modal';
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
    <CenteredModal
      open={open}
      onClose={() => onOpenChange(false)}
      className="sm:max-w-[500px]"
      ariaLabel="Share Your Feedback"
    >
      <div className="space-y-1 mb-4">
        <h2 className="text-lg font-semibold leading-none tracking-tight">Share Your Feedback</h2>
        <p className="text-sm text-muted-foreground">
          {sessionTitle
            ? `How was your experience in "${sessionTitle}"?`
            : `Rate your experience with ${trainerName}`}
        </p>
      </div>

      <FeedbackForm
        trainerId={trainerId}
        trainerName={trainerName}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        {...(sessionId ? { sessionId } : {})}
      />
    </CenteredModal>
  );
}
