import { Router } from 'express';
import {
  login,
  getMe,
  logout,
  getStudentPermanentQr,
} from '../controllers/auth.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.get('/student/qr-token', requireAuth, requireRole([Role.STUDENT]), getStudentPermanentQr);

export default router;
