import { redirect } from 'next/navigation';

// Konsolidiert (Sanierungsplan Phase 2.1.2): Trainerstunden buchen ist jetzt
// Teil des Platzkalenders (/scheduler, Agenda-Ansicht, Abschnitt
// „Trainerstunden") statt einer eigenen Seite mit eigenem Trainer-Auswahlflow.
export default function MemberTrainerBookingRedirect() {
  redirect('/scheduler');
}
