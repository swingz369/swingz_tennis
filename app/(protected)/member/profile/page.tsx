import { redirect } from 'next/navigation';

// Konsolidiert: das Profil (inkl. Saison-Stats & Head-to-Head) lebt unter /profile.
export default function MemberProfileRedirect() {
  redirect('/profile');
}
