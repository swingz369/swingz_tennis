import { MyBookings } from '@/components/bookings/my-bookings';
import MyGroups from '@/components/bookings/my-groups';

// Eigener Trainingsplan des Mitglieds — bis hierher leitete die Seite auf den
// Platzkalender um, sodass die Abmeldung von einer Trainingseinheit über keine
// Mitglieder-Oberfläche erreichbar war.
export default function MemberTrainingSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-display text-foreground dark:text-white">
          Mein Trainingsplan
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Deine kommenden Trainingseinheiten und Platzbuchungen — hier kannst du dich auch abmelden.
        </p>
      </div>
      <MyGroups />
      <MyBookings />
    </div>
  );
}
