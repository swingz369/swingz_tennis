/**
 * Central Type Definitions
 *
 * Canonical interfaces and types used across the application.
 * Import these instead of defining types inline.
 */

// ============================================================================
// User & Authentication
// ============================================================================

export type UserRole = 'superadmin' | 'admin' | 'trainer' | 'member';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserClub {
  clubId: string;
  club: Club;
  role: UserRole;
  joinedAt: string;
}

export interface UserMember {
  memberId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  bio?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dateOfBirth?: string;
  memberType: 'member' | 'trial' | 'inactive';
  membershipStatus: 'active' | 'inactive' | 'suspended' | 'terminated';
  membershipStart: string;
  membershipEnd?: string;
  trainingGroup?: string;
  notes?: string;
}

// ============================================================================
// Club
// ============================================================================

export interface Club {
  id: string;
  name: string;
  description?: string;
  maxMembers: number;
  defaultHourlyRate: number;
  status: 'active' | 'inactive' | 'suspended';
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// Sessions & Bookings
// ============================================================================

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show';

export interface Session {
  id: string;
  scheduleId: string;
  clubId: string;
  dayOfWeek: number; // 1-7, where 1 is Monday and 7 is Sunday
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  trainerId: string;
  trainerName?: string;
  groupIds: string[];
  groupNames?: string[];
  maxParticipants: number;
  notes?: string;
  week?: string;
  // User-specific fields
  bookedByUser?: boolean;
  bookingId?: string;
  bookingStatus?: BookingStatus;
}

export interface Booking {
  id: string;
  sessionId: string;
  memberId: string;
  memberName?: string;
  clubId: string;
  status: BookingStatus;
  bookedAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
}

export interface Attendee {
  bookingId: string;
  memberId: string;
  memberName: string;
  status: BookingStatus;
}

// ============================================================================
// Trainers
// ============================================================================

export interface Trainer {
  id: string;
  userId: string;
  clubId: string;
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  specializations?: string[];
  hourlyRate?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface TrainerStats {
  totalSessions: number;
  upcomingSessions: number;
  sessionsThisWeek: number;
  noShows: number;
  totalAttendees: number;
  averageRating?: number;
  totalFeedback?: number;
}

// ============================================================================
// Feedback
// ============================================================================

export interface Feedback {
  id: string;
  trainerId: string;
  trainerName?: string;
  memberId: string;
  memberName?: string;
  sessionId: string;
  sessionTitle?: string;
  clubId: string;
  rating: number; // 1-5
  comment?: string;
  isVisible: boolean;
  isFlagged: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface FeedbackStats {
  averageRating: number;
  totalCount: number;
  ratingDistribution: Record<number, number>; // rating -> count
}

// ============================================================================
// Courts
// ============================================================================

export interface Court {
  id: string;
  clubId: string;
  name: string;
  courtType: string;
  surface?: string;
  isIndoor: boolean;
  isActive: boolean;
  maintenanceNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CourtType {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  defaultDuration: number; // minutes
  maxPlayers: number;
  createdAt: string;
}

// ============================================================================
// Analytics
// ============================================================================

export interface KPI {
  label: string;
  value: number | string;
  change?: number; // percentage change
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface AnalyticsSummary {
  totalMembers: number;
  activeMembers: number;
  totalTrainers: number;
  totalSessions: number;
  totalBookings: number;
  averageAttendance: number;
  revenue?: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Audit Logs
// ============================================================================

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'restore';

export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  clubId?: string;
  action: AuditAction;
  entity: string; // e.g., 'member', 'booking', 'session'
  entityId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// ============================================================================
// API Responses
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  warnings?: Record<string, string>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId?: string;
  };
}

// ============================================================================
// Forms & Validation
// ============================================================================

export interface FormFieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormFieldError[];
}

// ============================================================================
// Utility Types
// ============================================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Nullable<T> = T | null;

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
};
