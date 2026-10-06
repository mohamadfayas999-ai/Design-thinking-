import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { prisma } from '../prisma.js';
import fs from 'fs';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || '30000');

/**
 * POST /api/ai/laundry-scan
 *
 * Accepts a student-uploaded image, forwards it to the Python AI service,
 * validates the response, stores a summary in AiScan, and returns
 * detections + annotated image to the client.
 *
 * Temporary files are always deleted after processing.
 */
export async function laundryAiScan(req: AuthenticatedRequest, res: Response) {
  const file = (req as any).file as Express.Multer.File | undefined;

  if (!file) {
    return res.status(400).json({
      success: false,
      message: 'No image uploaded. Please include an image file in the "image" field.',
    });
  }

  const user = req.user!;

  // Students only
  if (user.role !== 'STUDENT') {
    cleanupFile(file.path);
    return res.status(403).json({
      success: false,
      message: 'Only students can use the AI Laundry Scanner.',
    });
  }

  if (!user.studentProfileId) {
    cleanupFile(file.path);
    return res.status(400).json({
      success: false,
      message: 'Student profile not found.',
    });
  }

  try {
    // ── Forward image to Python AI service ──────────────────────
    const form = new FormData();
    form.append('image', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    let aiResponse: any;
    try {
      const response = await Promise.race([
        fetch(`${AI_SERVICE_URL}/predict`, {
          method: 'POST',
          body: form,
          headers: form.getHeaders(),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('AI service request timed out')),
            AI_SERVICE_TIMEOUT_MS
          )
        ),
      ]);

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        let errBody: any = {};
        if (contentType.includes('application/json')) {
          errBody = await response.json().catch(() => ({}));
        }
        return res.status(502).json({
          success: false,
          message: (errBody as any).error || (errBody as any).message || 'AI service returned an error.',
        });
      }

      if (contentType.includes('application/json')) {
        aiResponse = await response.json().catch(() => null);
      } else {
        return res.status(502).json({
          success: false,
          message: 'AI service returned an unexpected non-JSON response.',
        });
      }
    } catch (fetchErr: any) {
      if (fetchErr.message?.includes('timed out')) {
        return res.status(504).json({
          success: false,
          message:
            'AI service did not respond in time. Please try again in a moment.',
        });
      }
      // Could not reach service at all
      return res.status(503).json({
        success: false,
        message:
          'AI service is currently unavailable. Please try again later.',
      });
    }

    // ── Validate AI response ────────────────────────────────────
    if (!aiResponse || typeof aiResponse !== 'object') {
      return res.status(502).json({
        success: false,
        message: 'Invalid response received from AI service.',
      });
    }

    const detections = aiResponse.detections ?? [];
    const summary = aiResponse.summary ?? { totalItems: 0, counts: {}, averageConfidence: 0 };

    // ── Persist scan summary (no raw image stored) ───────────────
    let createdScanId: string | undefined;
    if (detections.length > 0) {
      try {
        const createdScan = await prisma.aiScan.create({
          data: {
            studentId:         user.studentProfileId,
            hostelId:          user.hostelId!,
            visibleClothingCount: summary.totalItems,
            clothingType:      buildClothingTypeString(summary.counts),
            mainColor:         'Multi-color',
            possibleStain:     'Not checked',
            stainSeverity:     'Unknown',
            confidence:        confidenceLevel(summary.averageConfidence),
            itemsJson:         JSON.stringify(summary.counts),
            washMode:          'Standard',
            preTreatment:      'None',
            detergentLevel:    'Normal',
          },
        });
        createdScanId = createdScan.id;
      } catch (dbErr) {
        // DB write failure is non-fatal — still return results to student
        console.error('[AI Scan] DB write failed (non-fatal):', dbErr);
      }
    }

    // ── Return result to frontend ────────────────────────────────
    return res.status(200).json({
      success: true,
      scanId: createdScanId || null,
      isMock: aiResponse.isMock ?? false,
      mockWarning: aiResponse.mockWarning ?? null,
      detections,
      summary,
      annotatedImage: aiResponse.annotatedImage ?? null,
    });
  } finally {
    // Always clean up the temp file
    cleanupFile(file.path);
  }
}

/**
 * GET /api/ai/status
 * Checks whether the AI service is reachable.
 */
export async function aiServiceStatus(_req: Request, res: Response) {
  try {
    const response = await Promise.race([
      fetch(`${AI_SERVICE_URL}/health`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ]);
    const data = await response.json();
    return res.status(200).json({
      success: true,
      aiService: data,
    });
  } catch {
    return res.status(200).json({
      success: true,
      aiService: null,
      message: 'AI service is offline or unreachable.',
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function cleanupFile(filePath: string) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // silently ignore cleanup errors
    }
  }
}

function buildClothingTypeString(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (!entries.length) return 'UNKNOWN';
  return entries.map(([k, v]) => `${k}:${v}`).join(', ');
}

function confidenceLevel(avg: number): string {
  if (avg >= 0.80) return 'High';
  if (avg >= 0.60) return 'Medium';
  return 'Low';
}
