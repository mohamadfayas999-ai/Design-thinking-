import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import {
  getAdminSummary,
  getAdminOrders,
  getAdminComplaints,
  resolveComplaint,
  getAdminStorage,
  getAdminTodaySlots,
  getAdminStudents,
  getAdminStaff,
  getAdminAuditLogs,
} from '../controllers/admin.controller.js';

const router = Router();

// All admin routes strictly require authentication + ADMIN role
router.use(requireAuth, requireRole([Role.ADMIN]));

// Admin Summary & Operational Metrics
router.get('/summary', getAdminSummary);

// Laundry Orders Monitoring
router.get('/orders', getAdminOrders);

// Complaint Management
router.get('/complaints', getAdminComplaints);
router.patch('/complaints/:id/resolve', resolveComplaint);

// Storage Monitoring
router.get('/storage', getAdminStorage);

// Slot / Booking Analytics & Today's Slots
router.get('/slots/today', getAdminTodaySlots);

// Student & Staff Operational Visibility
router.get('/students', getAdminStudents);
router.get('/staff', getAdminStaff);

// System Audit Logs
router.get('/audit-logs', getAdminAuditLogs);

export default router;
