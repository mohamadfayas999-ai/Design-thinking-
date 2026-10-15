import { Router } from 'express';
import {
  getAvailableSlots,
  getMyActiveBooking,
  bookSlot,
  cancelBooking,
  getStudentUsage,
  planBatchHandler,
  bookMultiBatchHandler,
  cancelBatchGroupHandler,
} from '../controllers/slots.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';

const router = Router();

// All slot routes require authentication and student role
router.use(requireAuth);
router.use(requireRole([Role.STUDENT]));

// GET available slots for the student's hostel
router.get('/available', getAvailableSlots);

// GET current student's active booking
router.get('/my-active', getMyActiveBooking);

// GET monthly usage for current student
router.get('/usage', getStudentUsage);

// POST plan smart batches and get advisory slot recommendations (Phase 3)
router.post('/plan-batch', planBatchHandler);

// POST book multiple batches atomically (Phase 4)
router.post('/book-multi-batch', bookMultiBatchHandler);

// POST book a slot
router.post('/book', bookSlot);

// DELETE cancel an entire batch group atomically (Phase 4)
router.delete('/cancel-batch-group/:groupId', cancelBatchGroupHandler);

// DELETE cancel a booking
router.delete('/cancel/:id', cancelBooking);

export default router;
