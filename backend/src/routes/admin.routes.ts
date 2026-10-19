import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import {
  getAdminSummary,
  getAdminOrders,
  getAdminBookings,
  getAdminComplaints,
  resolveComplaint,
  getAdminStorage,
  getAdminTodaySlots,
  getAdminStudents,
  getAdminStaff,
  getAdminAuditLogs,
  getAdminHistory,
  getAdminNotifications,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes strictly require authentication + ADMIN role
router.use(requireAuth, requireRole([Role.ADMIN]));

// Admin Summary & Operational Metrics
router.get('/summary', getAdminSummary);

// Bookings Management (with batch info, weights, garment breakdown)
router.get('/bookings', getAdminBookings);

// Laundry Orders Monitoring
router.get('/orders', getAdminOrders);

// Complaint Management
router.get('/complaints', getAdminComplaints);
router.patch('/complaints/:id/resolve', resolveComplaint);

// Storage Monitoring
router.get('/storage', getAdminStorage);

// Slot / Booking Analytics & Today's Slots
router.get('/slots/today', getAdminTodaySlots);

// Student / Resident & Staff Operational Visibility
router.get('/students', getAdminStudents);
router.get('/staff', getAdminStaff);

// Laundry History & Notifications (environment-scoped)
router.get('/history', getAdminHistory);
router.get('/notifications', getAdminNotifications);

// System Audit Logs
router.get('/audit-logs', getAdminAuditLogs);

export default router;
