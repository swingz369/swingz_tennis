export interface Member {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: 'member' | 'trainer' | 'admin' | 'superadmin';
  is_active: boolean;
  joined_at: string;
}
