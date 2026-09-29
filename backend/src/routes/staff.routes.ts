import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import {
  getStaffDashboard,
  getStaffBookings,
  getBookingDetail,
  getStorage,
  performIntake,
  getOrderDetail,
  completeOrder,
} from '../controllers/staff.controller.js';

const router = Router();

// All staff routes require authentication + STAFF role
router.use(requireAuth, requireRole([Role.STAFF]));

// Dashboard summary
router.get('/dashboard', getStaffDashboard);

// Bookings list (with optional date/status/search query params)
router.get('/bookings', getStaffBookings);

// Single booking detail
router.get('/bookings/:id', getBookingDetail);

// Intake operation (atomic)
router.post('/bookings/:id/intake', performIntake);

// Storage (rack/shelf) availability
router.get('/storage', getStorage);

// Order detail
router.get('/orders/:id', getOrderDetail);

// Phase 4: Mark an IN_PROGRESS order as COMPLETED
router.post('/orders/:id/complete', completeOrder);

export default router;
