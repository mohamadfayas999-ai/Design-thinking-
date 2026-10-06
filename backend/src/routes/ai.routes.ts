import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { laundryAiScan, aiServiceStatus } from '../controllers/ai.controller.js';
import { Role } from '../types/models.js';

const router = Router();

// ── Multer: store image to system temp directory, then always delete after ──
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
  fileFilter(_req, file, callback) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return callback(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`));
    }
    callback(null, true);
  },
});

// ── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/laundry-scan
 * Student uploads a laundry photo → AI service → detection results
 */
router.post(
  '/laundry-scan',
  requireAuth,
  requireRole([Role.STUDENT]),
  upload.single('image'),
  laundryAiScan
);

/**
 * GET /api/ai/status
 * Returns AI service health (used by frontend to show availability warning)
 */
router.get('/status', requireAuth, aiServiceStatus);

export default router;
