'use client';

import { TrainerAvailabilityPanel } from './trainer-availability';

export function TrainerScheduleStep() {
  return (
    <div className="space-y-6">
      <TrainerAvailabilityPanel />
    </div>
  );
}
