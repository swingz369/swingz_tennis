export interface Member {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: 'member' | 'trainer' | 'admin' | 'superadmin';
  is_active: boolean;
  joined_at: string;
  // Expanded fields
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  date_of_birth?: string | null;
  bio?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
}
