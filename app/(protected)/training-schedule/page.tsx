import { redirect } from 'next/navigation';

// This page is now integrated as the "Training" tab in /bookings
export default function MemberTrainingSchedulePage() {
  redirect('/bookings?tab=training');
}
