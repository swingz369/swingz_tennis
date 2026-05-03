export interface Member {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  memberType: 'member' | 'trial' | 'inactive';
  membershipStatus: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart?: string;
  membershipEnd?: string;
  trainingGroup?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberInput {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address?: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  memberType: 'member' | 'trial' | 'inactive';
  membershipStatus: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart?: string;
  membershipEnd?: string;
  trainingGroup?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
}

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: {
    street: string;
    houseNumber: string;
    postalCode: string;
    city: string;
  };
  memberType?: 'member' | 'trial' | 'inactive';
  membershipStatus?: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart?: string;
  membershipEnd?: string;
  trainingGroup?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  notes?: string;
}

export interface MemberQuery {
  status?: Member['membershipStatus'];
  type?: Member['memberType'];
  trainingGroup?: string;
  search?: string;
}
