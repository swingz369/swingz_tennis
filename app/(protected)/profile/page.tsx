import { requireAuth } from '@/lib/auth';
import MemberProfile from '@/components/member-profile';

export default async function MemberProfilePage() {
  // Ensure user is authenticated before rendering the profile page
  await requireAuth();

  return <MemberProfile />;
}
