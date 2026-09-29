import { Router } from 'express';
import {
  getAvailableSlots,
  getMyActiveBooking,
  bookSlot,
  cancelBooking,
  getStudentUsage,
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

// POST book a slot
router.post('/book', bookSlot);

// DELETE cancel a booking
router.delete('/cancel/:id', cancelBooking);

export default router;
