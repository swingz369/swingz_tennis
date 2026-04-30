import { z } from 'zod';

export const sendRemindersSchema = z.object({
  dryRun: z.boolean().optional().default(false), // If true, only log without sending
});

export type SendRemindersInput = z.infer<typeof sendRemindersSchema>;

export interface ReminderResult {
  sessionId: string;
  memberId: string;
  memberEmail: string;
  memberName: string;
  sessionStart: string;
  sessionEnd: string;
  trainerName?: string | undefined;
  courtName?: string | undefined;
  clubName?: string | undefined;
  status: 'sent' | 'skipped' | 'failed';
  error?: string | undefined;
}
