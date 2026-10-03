import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import { analyzeLaundryImage, ImageValidationError } from '../services/aiVision.service.js';
import { computeRecommendation } from '../utils/aiRules.js';

// ────────────────────────────────────────────────
// POST /api/student/ai-laundry-scan
// Analyzes student laundry image and stores AI estimate
// ────────────────────────────────────────────────
export async function performAiLaundryScan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
      include: { hostel: true },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const { imageBase64, mimeType, bookingId } = req.body;

    // Optional booking validation & hostel isolation
    let targetBooking = null;
    if (bookingId) {
      targetBooking = await prisma.slotBooking.findUnique({
        where: { id: bookingId },
        include: { slot: true, laundryOrder: true },
      });

      if (!targetBooking) {
        return res.status(404).json({ success: false, message: 'Laundry booking not found.' });
      }

      // Student must own booking
      if (targetBooking.studentId !== studentProfile.id) {
        return res.status(403).json({
          success: false,
          message: 'You are not authorized to attach a scan to this booking.',
        });
      }

      // Hostel isolation
      if (targetBooking.slot.hostelId !== studentProfile.hostelId) {
        return res.status(403).json({
          success: false,
          message: 'Cross-hostel scan operations are not permitted.',
        });
      }
    }

    // Perform vision analysis
    let observation;
    try {
      observation = await analyzeLaundryImage({ imageBase64, mimeType });
    } catch (err: any) {
      if (err instanceof ImageValidationError) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
      }
      return res.status(500).json({
        success: false,
        message: 'AI scan unavailable. You can continue with normal booking.',
        error: err?.message,
      });
    }

    // Compute deterministic laundry recommendation
    const recommendation = computeRecommendation(observation);

    // Save AiScan record
    const aiScan = await prisma.aiScan.create({
      data: {
        studentId: studentProfile.id,
        hostelId: studentProfile.hostelId,
        bookingId: targetBooking ? targetBooking.id : undefined,
        laundryOrderId: targetBooking?.laundryOrder ? targetBooking.laundryOrder.id : undefined,
        visibleClothingCount: observation.visibleClothingCount,
        clothingType: observation.clothingType,
        mainColor: observation.mainColor,
        possibleStain: observation.possibleStain,
        stainSeverity: observation.stainSeverity,
        confidence: observation.confidence,
        itemsJson: observation.items ? JSON.stringify(observation.items) : null,
        washMode: recommendation.washMode,
        preTreatment: recommendation.preTreatment,
        detergentLevel: recommendation.detergentLevel,
      },
    });

    return res.status(200).json({
      success: true,
      scanId: aiScan.id,
      estimate: {
        visibleClothingCount: aiScan.visibleClothingCount,
        clothingType: aiScan.clothingType,
        mainColor: aiScan.mainColor,
        possibleStain: aiScan.possibleStain,
        stainSeverity: aiScan.stainSeverity,
        confidence: aiScan.confidence,
        items: observation.items || [],
        recommendation: {
          washMode: aiScan.washMode,
          preTreatment: aiScan.preTreatment,
          detergentLevel: aiScan.detergentLevel,
          detergentNote: recommendation.detergentNote,
        },
      },
      disclaimer: 'AI-generated estimate. Laundry staff must verify before processing.',
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/student/ai-laundry-scan/:id
// Get an AI scan for the authenticated student
// ────────────────────────────────────────────────
export async function getStudentAiScan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const { id } = req.params;
    const scan = await prisma.aiScan.findUnique({
      where: { id },
    });

    if (!scan) {
      return res.status(404).json({ success: false, message: 'AI scan not found.' });
    }

    // Student privacy: student can only access their own scan
    if (scan.studentId !== studentProfile.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    let parsedItems = [];
    if (scan.itemsJson) {
      try {
        parsedItems = JSON.parse(scan.itemsJson);
      } catch {
        parsedItems = [];
      }
    }

    return res.status(200).json({
      success: true,
      scan: {
        id: scan.id,
        visibleClothingCount: scan.visibleClothingCount,
        clothingType: scan.clothingType,
        mainColor: scan.mainColor,
        possibleStain: scan.possibleStain,
        stainSeverity: scan.stainSeverity,
        confidence: scan.confidence,
        items: parsedItems,
        washMode: scan.washMode,
        preTreatment: scan.preTreatment,
        detergentLevel: scan.detergentLevel,
        staffConfirmed: scan.staffConfirmed,
        confirmedType: scan.confirmedType,
        confirmedColor: scan.confirmedColor,
        confirmedStain: scan.confirmedStain,
        confirmedSeverity: scan.confirmedSeverity,
        confirmedRecommendation: scan.confirmedRecommendation,
        confirmedAt: scan.confirmedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// PUT /api/staff/bookings/:id/ai-scan-confirm
// Staff confirms or corrects AI scan observations
// ────────────────────────────────────────────────
export async function confirmStaffAiScan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STAFF) {
      return res.status(403).json({ success: false, message: 'Staff access only' });
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found.' });
    }

    const { id: bookingId } = req.params;
    const {
      confirmedType,
      confirmedColor,
      confirmedStain,
      confirmedSeverity,
      confirmedRecommendation,
    } = req.body;

    const booking = await prisma.slotBooking.findUnique({
      where: { id: bookingId },
      include: {
        slot: true,
        aiScan: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Hostel isolation: Staff only for their hostel
    if (booking.slot.hostelId !== staff.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to confirm scans for another hostel.',
      });
    }

    if (!booking.aiScan) {
      return res.status(404).json({
        success: false,
        message: 'No AI scan is associated with this booking.',
      });
    }

    // Update staff confirmation while keeping original AI estimate intact
    const updated = await prisma.aiScan.update({
      where: { id: booking.aiScan.id },
      data: {
        staffConfirmed: true,
        confirmedType: confirmedType || booking.aiScan.clothingType,
        confirmedColor: confirmedColor || booking.aiScan.mainColor,
        confirmedStain: confirmedStain || booking.aiScan.possibleStain,
        confirmedSeverity: confirmedSeverity || booking.aiScan.stainSeverity,
        confirmedRecommendation:
          confirmedRecommendation || `${booking.aiScan.washMode} (${booking.aiScan.preTreatment})`,
        confirmedAt: new Date(),
        confirmedByStaffId: staff.id,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'AI observations confirmed by staff.',
      aiScan: {
        id: updated.id,
        // Original AI estimate preserved
        aiEstimate: {
          visibleClothingCount: updated.visibleClothingCount,
          clothingType: updated.clothingType,
          mainColor: updated.mainColor,
          possibleStain: updated.possibleStain,
          stainSeverity: updated.stainSeverity,
          washMode: updated.washMode,
          preTreatment: updated.preTreatment,
          detergentLevel: updated.detergentLevel,
        },
        // Staff confirmed operational values
        staffConfirmed: {
          isConfirmed: updated.staffConfirmed,
          confirmedType: updated.confirmedType,
          confirmedColor: updated.confirmedColor,
          confirmedStain: updated.confirmedStain,
          confirmedSeverity: updated.confirmedSeverity,
          confirmedRecommendation: updated.confirmedRecommendation,
          confirmedAt: updated.confirmedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
