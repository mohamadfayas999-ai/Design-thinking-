export type Role = 'STUDENT' | 'STAFF' | 'ADMIN';

export interface Hostel {
  id: string;
  name: string;
  code: string;
  description?: string;
  environment?: 'COLLEGE' | 'PG_SHARED';
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
  environment?: 'COLLEGE' | 'PG_SHARED';
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
  shirtCount?: number;
  tshirtCount?: number;
  pantsCount?: number;
  jeansCount?: number;
  shortsCount?: number;
  totalWeightGrams?: number;
  tShirtShirtCount: number;
  pantsTrackCount: number;
  totalCount: number;
  isLocked?: boolean;
}

export interface ActiveBookingBatch {
  id: string;
  status: string;
  bookedAt: string;
  batchGroupId?: string | null;
  batchNumber?: number;
  totalBatches?: number;
  weightGrams?: number | null;
  orderId?: string | null;
  orderStatus: string | null;
  canCancel: boolean;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  itemCount: ItemCount | null;
  complaint?: ComplaintInfo | null;
  aiScan?: AiScanData | null;
}

export interface ActiveBooking {
  id: string;
  status: string;
  orderStatus: string | null;
  orderId?: string | null;
  canCancel: boolean;
  bookedAt: string;
  batchGroupId?: string | null;
  batchNumber?: number;
  totalBatches?: number;
  weightGrams?: number | null;
  isMultiBatch?: boolean;
  batches?: ActiveBookingBatch[];
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  itemCount: ItemCount | null;
  complaint?: ComplaintInfo | null;
  aiScan?: AiScanData | null;
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
  batchGroupId?: string | null;
  batchNumber?: number;
  totalBatches?: number;
  weightGrams?: number | null;
  student: StaffBookingStudent;
  slot: StaffBookingSlot;
  laundryOrder: StaffOrderSummary | null;
  aiScan?: AiScanData | null;
}

export interface StaffQrLookupResponse {
  success: boolean;
  message?: string;
  resident?: {
    id: string;
    name: string;
    studentId: string;
    department: string;
  };
  eligibleBookingsCount?: number;
  bookings?: StaffBooking[];
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
  aiScan?: AiScanData | null;
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

// ── Optional AI Laundry Scanner Types ───────────────

export interface AiItemObservation {
  type: 'T-Shirt/Shirt' | 'Pants/Track' | 'UNKNOWN';
  color: string;
  possibleStain: string;
  stainSeverity: 'None' | 'Low' | 'Medium' | 'High' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
}

export interface AiLaundryRecommendation {
  washMode: string;
  preTreatment: string;
  detergentLevel: 'Low' | 'Medium' | 'High';
  detergentNote: string;
}

export interface AiLaundryEstimate {
  visibleClothingCount: number;
  clothingType: string;
  mainColor: string;
  possibleStain: string;
  stainSeverity: 'None' | 'Low' | 'Medium' | 'High' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
  items?: AiItemObservation[];
  recommendation: AiLaundryRecommendation;
}

export interface AiScanData {
  id: string;
  visibleClothingCount: number;
  clothingType: string;
  mainColor: string;
  possibleStain: string;
  stainSeverity: 'None' | 'Low' | 'Medium' | 'High' | 'Unknown';
  confidence: 'High' | 'Medium' | 'Low';
  items?: AiItemObservation[];
  washMode: string;
  preTreatment: string;
  detergentLevel: string;
  staffConfirmed: boolean;
  confirmedType?: string | null;
  confirmedColor?: string | null;
  confirmedStain?: string | null;
  confirmedSeverity?: string | null;
  confirmedRecommendation?: string | null;
  confirmedAt?: string | null;
}

export interface AiScanResponse {
  success: boolean;
  scanId: string;
  estimate: AiLaundryEstimate;
  disclaimer: string;
}

// ── AI Clothing Detection (YOLO) Types ────────────────────────

export interface ClothingBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ClothingDetection {
  class: string;
  classDisplay: string;
  emoji: string;
  confidence: number;
  bbox: ClothingBBox;
}

export interface ClothingScanSummary {
  totalItems: number;
  counts: Record<string, number>;
  averageConfidence: number;
}

export interface AiClothingScanResult {
  success: boolean;
  scanId?: string | null;
  isMock: boolean;
  mockWarning: string | null;
  detections: ClothingDetection[];
  summary: ClothingScanSummary;
  annotatedImage: string | null;
  message?: string;
}

export interface AiServiceHealth {
  status: string;
  mode: string;
  modelLoaded: boolean;
  classes: string[];
  threshold: number;
}

// ── Phase 3: Weight Calculation, Weekly Allowance & Batch Planning ──

export interface ApprovedGarmentCounts {
  shirt: number;
  tshirt: number;
  pants: number;
  jeans: number;
  shorts: number;
}

export interface WeightCalculationResult {
  totalApprovedWeightGrams: number;
  isConfirmed: boolean;
  requiresReview: boolean;
  approvedCounts: Record<string, number>;
  breakdown: Record<
    string,
    { count: number; unitWeightGrams: number; subtotalGrams: number }
  >;
  unresolvedItems: Array<{
    className: string;
    count: number;
    reason: string;
  }>;
}

export interface BatchPlanItem {
  batchNumber: number;
  totalBatches: number;
  weightGrams: number;
  maxLimitGrams: number;
  itemCount: number;
  garmentCounts: Record<string, number>;
}

export interface BatchPlanResult {
  totalWeightGrams: number;
  totalBatches: number;
  batches: BatchPlanItem[];
  isConfirmed: boolean;
  unbatchableGarments?: Array<{ className: string; weightGrams: number }>;
}

export interface ScheduledWeekInfo {
  weekStartDateStr: string;
  weekEndDateStr: string;
  weekStartIstIso: string;
  weekEndIstIso: string;
  weekLabel: string;
  slotDateStr: string;
}

export interface WeeklyAllowanceStatus {
  scheduledWeek: ScheduledWeekInfo;
  maxWeeklyAllowanceGrams: number;
  committedWeightGrams: number;
  remainingAllowanceGrams: number;
  proposedWeightGrams: number;
  projectedTotalWeightGrams: number;
  fitsWithinAllowance: boolean;
  isReliable: boolean;
  hasLegacyUnweightedBookings: boolean;
  legacyUnweightedBookingCount: number;
  warning?: string;
  activeBookingCount: number;
}

export interface RecommendedSlot {
  slotId: string;
  hostelId: string;
  hostelName: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  availableSpots: number;
  scheduledWeekLabel: string;
}

export interface BatchRecommendation {
  batch: BatchPlanItem;
  recommendedSlots: RecommendedSlot[];
  hasAvailableSlots: boolean;
}

export interface SmartPlanningResponse {
  success: boolean;
  planningStatus: 'CONFIRMED' | 'REQUIRES_REVIEW' | 'EXCEEDS_ALLOWANCE' | 'NO_SLOTS' | 'UNBATCHABLE' | 'EMPTY';
  weightCalculation: WeightCalculationResult;
  batchPlan?: BatchPlanResult;
  weeklyAllowance: WeeklyAllowanceStatus;
  batchRecommendations: BatchRecommendation[];
  warnings: string[];
  isActionable: boolean;
  facility: {
    id: string;
    name: string;
    environment: string;
  };
}

export interface BatchSlotAssignment {
  batchNumber: number;
  slotId: string;
}

export interface MultiBatchBookingRequest {
  garmentCounts: Record<string, number>;
  batchSlotAssignments: BatchSlotAssignment[];
  idempotencyKey: string;
}

export interface BookedBatchItem {
  id: string;
  batchNumber: number;
  totalBatches: number;
  weightGrams: number;
  status: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  garmentCounts: Record<string, number>;
}

export interface MultiBatchBookingResponse {
  success: boolean;
  isIdempotentReplay: boolean;
  batchGroupId: string;
  totalBatches: number;
  totalWeightGrams: number;
  bookings: BookedBatchItem[];
  message: string;
}

export interface CancelBatchGroupResponse {
  success: boolean;
  message: string;
  batchGroupId: string;
  cancelledBatches: number;
  totalBatches: number;
}
