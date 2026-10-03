import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import {
  getStudentNotifications,
  verifyOrder,
  submitComplaint,
  getStudentHistory,
  getStudentComplaints,
  getStudentOrder,
} from '../controllers/student.controller.js';
import {
  performAiLaundryScan,
  getStudentAiScan,
} from '../controllers/aiScan.controller.js';

const router = Router();

// All student routes require authentication + STUDENT role
router.use(requireAuth, requireRole([Role.STUDENT]));

// Notifications (completion alerts)
router.get('/notifications', getStudentNotifications);

// Single order detail (student-safe, no rack/shelf)
router.get('/orders/:id', getStudentOrder);

// Verify a completed order
router.post('/orders/:id/verify', verifyOrder);

// Submit a complaint for a completed order
router.post('/orders/:id/complaint', submitComplaint);

// Full laundry history
router.get('/history', getStudentHistory);

// Complaint status list
router.get('/complaints', getStudentComplaints);

// Optional AI Laundry Scanner
router.post('/ai-laundry-scan', performAiLaundryScan);
router.get('/ai-laundry-scan/:id', getStudentAiScan);

export default router;
