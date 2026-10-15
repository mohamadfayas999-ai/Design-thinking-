import {
  ApiResponse,
  Hostel,
  Role,
  User,
  LaundrySlot,
  ActiveBooking,
  MonthlyUsage,
  CompletionNotification,
  StudentOrderSummary,
  LaundryHistoryItem,
  ComplaintType,
  AdminSummaryMetrics,
  AdminHostelSummary,
  AdminDemandInsights,
  AdminOrder,
  AdminComplaint,
  AdminStorageLocation,
  AdminTodaySlot,
  AdminStudent,
  AdminStaff,
  AdminAuditLog,
  AiClothingScanResult,
  AiServiceHealth,
  SmartPlanningResponse,
  MultiBatchBookingRequest,
  MultiBatchBookingResponse,
  CancelBatchGroupResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('washwise_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      data?.message ||
      data?.error ||
      (response.status === 404
        ? `API endpoint ${endpoint} was not found on the server (404).`
        : `Request failed with status ${response.status}`);
    throw new ApiError(errorMsg, response.status);
  }

  if (!data) {
    throw new ApiError(
      `Invalid server response format for ${endpoint}. Expected JSON but received ${contentType || 'non-JSON'}.`,
      response.status
    );
  }

  return data;
}

export const api = {
  // Health
  checkHealth: () => request<ApiResponse>('/health'),

  // Hostels
  getHostels: () => request<ApiResponse<Hostel[]>>('/hostels'),

  // Auth
  login: (credentials: {
    email: string;
    password: string;
    role: Role;
    hostelId?: string;
  }) =>
    request<{
      success: boolean;
      message: string;
      token: string;
      user: User;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () => request<ApiResponse<User>>('/auth/me'),

  logout: () =>
    request<ApiResponse>('/auth/logout', {
      method: 'POST',
    }),

  // Student specific QR Token
  getStudentQrToken: () =>
    request<{
      success: boolean;
      qrToken: string;
      studentId: string;
    }>('/auth/student/qr-token'),

  // ── Phase 2: Slots & Bookings ────────────────────────

  // Get available slots for the authenticated student's hostel
  getAvailableSlots: () =>
    request<{ success: boolean; slots: LaundrySlot[] }>('/slots/available'),

  // Get current student's active booking
  getMyActiveBooking: () =>
    request<{ success: boolean; booking: ActiveBooking | null }>('/slots/my-active'),

  // Get monthly usage
  getStudentUsage: () =>
    request<{ success: boolean; usage: MonthlyUsage }>('/slots/usage'),

  // Book a slot
  bookSlot: (data: {
    slotId: string;
    tShirtShirtCount: number;
    pantsTrackCount: number;
    aiScanId?: string;
  }) =>
    request<{
      success: boolean;
      message: string;
      booking: ActiveBooking;
    }>('/slots/book', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Plan smart batches and get advisory slot recommendations (Phase 3)
  planBatch: (data: {
    garmentCounts: Record<string, number>;
    targetDate?: string;
  }) =>
    request<SmartPlanningResponse>('/slots/plan-batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Book multiple batches atomically (Phase 4)
  bookMultiBatch: (data: MultiBatchBookingRequest) =>
    request<MultiBatchBookingResponse>('/slots/book-multi-batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Cancel an entire batch group atomically (Phase 4)
  cancelBatchGroup: (batchGroupId: string) =>
    request<CancelBatchGroupResponse>(`/slots/cancel-batch-group/${batchGroupId}`, {
      method: 'DELETE',
    }),

  // Cancel a booking
  cancelBooking: (bookingId: string) =>
    request<{ success: boolean; message: string }>(`/slots/cancel/${bookingId}`, {
      method: 'DELETE',
    }),

  // ── Phase 3: Staff Operations ────────────────────────

  // Staff dashboard
  getStaffDashboard: () =>
    request<{ success: boolean; dashboard: import('../types').StaffDashboard }>('/staff/dashboard'),

  // Staff bookings list (optional query params: date, status, search)
  getStaffBookings: (params?: { date?: string; status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ success: boolean; bookings: import('../types').StaffBooking[] }>(
      `/staff/bookings${query}`
    );
  },

  // Single booking detail
  getStaffBookingDetail: (bookingId: string) =>
    request<{ success: boolean; booking: import('../types').StaffBooking }>(
      `/staff/bookings/${bookingId}`
    ),

  // Secure Staff QR lookup (token submitted safely in body)
  qrLookup: (qrToken: string) =>
    request<import('../types').StaffQrLookupResponse>('/staff/qr-lookup', {
      method: 'POST',
      body: JSON.stringify({ qrToken }),
    }),

  // Intake (atomic)
  performIntake: (
    bookingId: string,
    data: {
      tShirtShirtCount: number;
      pantsTrackCount: number;
      rackShelfId: string;
      aiScanConfirmation?: {
        confirmedType?: string;
        confirmedColor?: string;
        confirmedStain?: string;
        confirmedSeverity?: string;
        confirmedRecommendation?: string;
      };
    }
  ) =>
    request<{
      success: boolean;
      message: string;
      order: import('../types').LaundryOrderDetail;
    }>(`/staff/bookings/${bookingId}/intake`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Storage
  getStorage: () =>
    request<{
      success: boolean;
      storage: import('../types').RackShelfLocation[];
      byRack: Record<number, import('../types').RackShelfLocation[]>;
    }>('/staff/storage'),

  // Order detail
  getOrderDetail: (orderId: string) =>
    request<{ success: boolean; order: import('../types').LaundryOrderDetail }>(
      `/staff/orders/${orderId}`
    ),

  // ── Phase 4: Staff Completion ────────────────────────

  // Staff: mark order as COMPLETED
  completeOrder: (orderId: string) =>
    request<{ success: boolean; message: string; orderId: string; status: string; completedAt: string }>(
      `/staff/orders/${orderId}/complete`,
      { method: 'POST' }
    ),

  // ── Phase 4: Student Pickup Flow ────────────────────────

  // Get student completion notifications
  getStudentNotifications: () =>
    request<{ success: boolean; notifications: CompletionNotification[] }>(
      '/student/notifications'
    ),

  // Get single student order (no rack/shelf exposed)
  getStudentOrder: (orderId: string) =>
    request<{ success: boolean; order: StudentOrderSummary }>(
      `/student/orders/${orderId}`
    ),

  // Verify completed order (COMPLETED → VERIFIED)
  verifyOrder: (orderId: string) =>
    request<{ success: boolean; message: string; orderId: string; status: string; verifiedAt: string }>(
      `/student/orders/${orderId}/verify`,
      { method: 'POST' }
    ),

  // Submit complaint for completed order (COMPLETED → UNDER_REVIEW)
  submitComplaint: (orderId: string, data: { type: ComplaintType; additionalDetails?: string }) =>
    request<{
      success: boolean;
      message: string;
      complaint: { id: string; type: string; status: string; createdAt: string };
      orderStatus: string;
    }>(`/student/orders/${orderId}/complaint`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get student laundry history
  getStudentHistory: () =>
    request<{ success: boolean; history: LaundryHistoryItem[]; count: number }>(
      '/student/history'
    ),

  // Get student complaints
  getStudentComplaints: () =>
    request<{ success: boolean; complaints: any[] }>('/student/complaints'),

  // PG Self-Service: Start wash cycle on machine
  startPgSelfServiceWash: (orderId: string) =>
    request<{ success: boolean; message: string; order: any }>(
      `/student/pg/orders/${orderId}/start-wash`,
      { method: 'POST' }
    ),

  // PG Self-Service: Mark wash cycle finished
  completePgSelfServiceWash: (orderId: string) =>
    request<{ success: boolean; message: string; order: any }>(
      `/student/pg/orders/${orderId}/complete-wash`,
      { method: 'POST' }
    ),

  // ── Phase 5: Admin Portal & Operational Analytics ───────────────────────

  // Admin: resolve a complaint (protected, ADMIN only)
  resolveComplaint: (complaintId: string) =>
    request<{ success: boolean; message: string; complaintId: string; status: string; resolvedAt: string }>(
      `/admin/complaints/${complaintId}/resolve`,
      { method: 'PATCH' }
    ),

  // Admin: get dashboard summary metrics, hostel overview & demand insights
  getAdminSummary: (hostelId?: string) => {
    const query = hostelId && hostelId !== 'ALL' ? `?hostelId=${hostelId}` : '';
    return request<{
      success: boolean;
      summary: AdminSummaryMetrics;
      hostels: AdminHostelSummary[];
      insights: AdminDemandInsights;
    }>(`/admin/summary${query}`);
  },

  // Admin: get laundry orders with filters
  getAdminOrders: (filters?: {
    hostelId?: string;
    status?: string;
    dateRange?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.hostelId && filters.hostelId !== 'ALL') params.set('hostelId', filters.hostelId);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.dateRange && filters.dateRange !== 'ALL') params.set('dateRange', filters.dateRange);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; count: number; orders: AdminOrder[] }>(`/admin/orders${qs}`);
  },

  // Admin: get complaints across hostels
  getAdminComplaints: (filters?: { hostelId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.hostelId && filters.hostelId !== 'ALL') params.set('hostelId', filters.hostelId);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; count: number; complaints: AdminComplaint[] }>(`/admin/complaints${qs}`);
  },

  // Admin: get storage locations and occupancy
  getAdminStorage: (hostelId?: string) => {
    const query = hostelId && hostelId !== 'ALL' ? `?hostelId=${hostelId}` : '';
    return request<{
      success: boolean;
      stats: { total: number; occupied: number; available: number; utilizationPercent: number };
      storage: AdminStorageLocation[];
    }>(`/admin/storage${query}`);
  },

  // Admin: get today's slots across hostels
  getAdminTodaySlots: (hostelId?: string) => {
    const query = hostelId && hostelId !== 'ALL' ? `?hostelId=${hostelId}` : '';
    return request<{ success: boolean; date: string; slots: AdminTodaySlot[] }>(`/admin/slots/today${query}`);
  },

  // Admin: get students list (scoped, sanitized, with monthly usage)
  getAdminStudents: (filters?: { hostelId?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.hostelId && filters.hostelId !== 'ALL') params.set('hostelId', filters.hostelId);
    if (filters?.search) params.set('search', filters.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; count: number; students: AdminStudent[] }>(`/admin/students${qs}`);
  },

  // Admin: get staff members list
  getAdminStaff: (hostelId?: string) => {
    const query = hostelId && hostelId !== 'ALL' ? `?hostelId=${hostelId}` : '';
    return request<{ success: boolean; count: number; staff: AdminStaff[] }>(`/admin/staff${query}`);
  },

  // Admin: get audit logs
  getAdminAuditLogs: (filters?: { limit?: number; entityType?: string; action?: string }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.entityType) params.set('entityType', filters.entityType);
    if (filters?.action) params.set('action', filters.action);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; count: number; logs: AdminAuditLog[] }>(`/admin/audit-logs${qs}`);
  },

  // ── Optional AI Laundry Scanner ─────────────────────
  scanLaundryWithAi: (data: { imageBase64: string; mimeType?: string; bookingId?: string }) =>
    request<import('../types').AiScanResponse>('/student/ai-laundry-scan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStudentAiScan: (scanId: string) =>
    request<{ success: boolean; scan: import('../types').AiScanData }>(
      `/student/ai-laundry-scan/${scanId}`
    ),

  confirmStaffAiScan: (
    bookingId: string,
    confirmation: {
      confirmedType?: string;
      confirmedColor?: string;
      confirmedStain?: string;
      confirmedSeverity?: string;
      confirmedRecommendation?: string;
    }
  ) =>
    request<{ success: boolean; message: string; aiScan: any }>(
      `/staff/bookings/${bookingId}/ai-scan-confirm`,
      {
        method: 'PUT',
        body: JSON.stringify(confirmation),
      }
    ),

  // ── YOLOv8 AI Laundry Cloth Detection ─────────────
  scanLaundryClothYolo: async (imageFile: File): Promise<AiClothingScanResult> => {
    const token = localStorage.getItem('washwise_token');
    const formData = new FormData();
    formData.append('image', imageFile);

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/ai/laundry-scan`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const contentType = response.headers.get('content-type') || '';
    let data: any = null;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }

    if (!response.ok || !data) {
      let errorMessage = data?.message || data?.error;
      if (!errorMessage) {
        if (response.status === 404) {
          errorMessage =
            'AI cloth scanner endpoint not found on server (404). Please ensure the backend is deployed.';
        } else if (response.status === 502 || response.status === 503 || response.status === 504) {
          errorMessage = 'AI detection service is currently unavailable or offline.';
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = 'Authentication error. Please log in as a student.';
        } else {
          errorMessage = `AI laundry scan request failed with HTTP ${response.status}.`;
        }
      }
      throw new ApiError(errorMessage, response.status);
    }

    return data;
  },

  getAiHealthStatus: () =>
    request<{ success: boolean; aiService: AiServiceHealth | null; message?: string }>('/ai/status'),
};
