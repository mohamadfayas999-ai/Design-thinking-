export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';

export interface Hostel {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  hostelId?: string | null;
  hostelName?: string | null;
  studentId?: string | null;
  department?: string | null;
  admissionYear?: number | null;
  staffId?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  token?: string;
  user?: User;
}

export interface StudentQrData {
  qrToken: string;
  studentId: string;
}

// ── Phase 2 types ──────────────────────────────────

export interface LaundrySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  isFull: boolean;
}

export interface ItemCount {
  tShirtShirtCount: number;
  pantsTrackCount: number;
  totalCount: number;
}

export interface ActiveBooking {
  id: string;
  status: string;
  orderStatus: string | null;
  canCancel: boolean;
  bookedAt: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  itemCount: ItemCount | null;
}

export interface MonthlyUsage {
  usedCount: number;
  maxCount: number;
  remainingCount: number;
  month: string;
  year: number;
  canBook: boolean;
}

// ── Phase 3 types ──────────────────────────────────

export interface StaffInfo {
  name: string;
  staffId: string;
  hostel: { id: string; name: string; code: string };
}

export interface DashboardStats {
  todayBookings: number;
  waitingCount: number;
  inProgressCount: number;
  totalStorage: number;
  availableStorage: number;
  occupiedStorage: number;
}

export interface TodaySlot {
  id: string;
  startTime: string;
  endTime: string;
  bookedCount: number;
  capacity: number;
}

export interface StaffDashboard {
  staff: StaffInfo;
  stats: DashboardStats;
  todaySlots: TodaySlot[];
}

export interface StaffBookingStudent {
  id: string;
  name: string;
  studentId: string;
  department: string;
  hostelId: string;
}

export interface StaffBookingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hostelId: string;
}

export interface StaffOrderSummary {
  id: string;
  status: string;
  startedAt: string | null;
  itemCount: ItemCount | null;
  rackShelf: RackShelfLocation | null;
  staff: { name: string; staffId: string } | null;
}

export interface StaffBooking {
  id: string;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
  student: StaffBookingStudent;
  slot: StaffBookingSlot;
  laundryOrder: StaffOrderSummary | null;
}

export interface RackShelfLocation {
  id: string;
  rackNumber: number;
  shelfNumber: number;
  label: string;
  isOccupied: boolean;
  occupiedBy: {
    orderId: string;
    studentName: string;
    studentId: string;
  } | null;
}

export interface LaundryOrderDetail {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt?: string | null;
  verifiedAt?: string | null;
  student: { name: string; studentId: string; department: string };
  staff: { name: string; staffId: string } | null;
  itemCount: ItemCount | null;
  rackShelf: RackShelfLocation | null;
  booking: {
    slot: { date: string; startTime: string; endTime: string };
  };
  hostel: { name: string; code: string };
}

// ── Phase 4 types ──────────────────────────────────

export type ComplaintType = 'CLOTHES_TORN' | 'NUMBER_OF_CLOTHES_REDUCED' | 'OTHER_ISSUE';
export type ComplaintStatus = 'UNDER_REVIEW' | 'RESOLVED';
export type OrderStatus =
  | 'BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'COMPLAINT'
  | 'UNDER_REVIEW'
  | 'RESOLVED';

export interface ComplaintInfo {
  id: string;
  type: ComplaintType;
  additionalDetails: string | null;
  status: ComplaintStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StudentOrderSummary {
  id: string;
  status: OrderStatus;
  completedAt: string | null;
  verifiedAt: string | null;
  startedAt: string | null;
  clothesCount: number;
  bookingDate: string;
  slotTiming: string;
  complaint: ComplaintInfo | null;
}

export interface CompletionNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  order: {
    id: string;
    completedAt: string | null;
    clothesCount: number;
    slot: { date: string; startTime: string; endTime: string };
  } | null;
}

export interface LaundryHistoryItem {
  orderId: string;
  status: OrderStatus;
  bookingDate: string;
  slotTiming: string;
  clothesCount: number;
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  complaint: ComplaintInfo | null;
}

// ── Phase 5 types: Admin Portal & Operational Analytics ──────────────────

export interface AdminSummaryMetrics {
  totalStudents: number;
  totalStaff: number;
  todayBookings: number;
  inProgressOrders: number;
  completedOrders: number;
  verifiedOrders: number;
  underReviewComplaints: number;
  resolvedComplaints: number;
  totalStorageLocations: number;
  occupiedStorageLocations: number;
  availableStorageLocations: number;
  storageUtilizationPercent: number;
}

export interface AdminHostelSummary {
  id: string;
  name: string;
  code: string;
  description?: string;
  studentCount: number;
  staffCount: number;
  todayBookingsCount: number;
  inProgressCount: number;
  completedCount: number;
  verifiedCount: number;
  underReviewComplaintsCount: number;
  storageTotal: number;
  storageOccupied: number;
  storageUtilizationPercent: number;
}

export interface AdminDemandInsights {
  busiestHostel: string;
  peakSlotTime: string;
  totalOrdersAllTime: number;
  avgClothesPerOrder: number;
  recent7DaysTrends: { date: string; count: number }[];
}

export interface AdminOrder {
  id: string;
  status: OrderStatus;
  submittedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  student: {
    id: string;
    name: string;
    studentId: string;
    department?: string | null;
    hostelId: string;
  };
  hostel: {
    id: string;
    name: string;
    code: string;
  };
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null;
  itemCount: {
    tShirtShirtCount: number;
    pantsTrackCount: number;
    totalCount: number;
    isLocked: boolean;
  } | null;
  rackShelf: {
    id: string;
    rackNumber: number;
    shelfNumber: number;
    label: string;
  } | null;
  staff: {
    name: string;
    staffId: string;
  } | null;
  complaint: {
    id: string;
    type: ComplaintType;
    status: ComplaintStatus;
    createdAt: string;
    resolvedAt: string | null;
  } | null;
}

export interface AdminComplaint {
  id: string;
  type: ComplaintType;
  additionalDetails: string | null;
  status: ComplaintStatus;
  createdAt: string;
  resolvedAt: string | null;
  student: {
    id: string;
    name: string;
    studentId: string;
    department?: string | null;
    hostel: { id: string; name: string; code: string };
  };
  order: {
    id: string;
    status: OrderStatus;
    startedAt: string | null;
    completedAt: string | null;
    verifiedAt: string | null;
    itemCount: {
      tShirtShirtCount: number;
      pantsTrackCount: number;
      totalCount: number;
    } | null;
    rackShelf: {
      id: string;
      rackNumber: number;
      shelfNumber: number;
      label: string;
    } | null;
    slot: {
      date: string;
      startTime: string;
      endTime: string;
    } | null;
  };
}

export interface AdminStorageLocation {
  id: string;
  hostel: { id: string; name: string; code: string };
  rackNumber: number;
  shelfNumber: number;
  label: string;
  isOccupied: boolean;
  occupiedBy: {
    orderId: string;
    studentName: string;
    studentId: string;
    status: string;
  } | null;
}

export interface AdminTodaySlot {
  id: string;
  hostel: { id: string; name: string; code: string };
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remainingCapacity: number;
  utilizationPercent: number;
}

export interface AdminStudent {
  id: string;
  name: string;
  studentId: string;
  email: string;
  isActive: boolean;
  department?: string | null;
  admissionYear?: number | null;
  hostel: { id: string; name: string; code: string };
  monthlyUsage: {
    used: number;
    max: number;
    remaining: number;
  };
}

export interface AdminStaff {
  id: string;
  name: string;
  staffId: string;
  email: string;
  isActive: boolean;
  hostel: { id: string; name: string; code: string };
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { email: string; role: string };
  reason: string | null;
  createdAt: string;
}



