import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import hostelRoutes from './hostel.routes.js';
import slotsRoutes from './slots.routes.js';
import staffRoutes from './staff.routes.js';
import studentRoutes from './student.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/hostels', hostelRoutes);
router.use('/slots', slotsRoutes);
router.use('/staff', staffRoutes);
router.use('/student', studentRoutes);
router.use('/admin', adminRoutes);

export default router;
