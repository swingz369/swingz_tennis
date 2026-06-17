import { redirect } from 'next/navigation';

// Training is accessible via the courts/bookings page
export default function MemberTrainingSchedulePage() {
  redirect('/bookings');
}
