import { Router } from 'express';
import { getHostels } from '../controllers/hostel.controller.js';

const router = Router();

router.get('/', getHostels);

export default router;
