import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import { isSlotInFuture } from '../utils/date.js';

const MAX_MONTHLY_USES = 4;
const MAX_CLOTHES_TOTAL = 20;
const MAX_CLOTHES_PER_CATEGORY = 20; // per individual category sanity check

// ────────────────────────────────────────────────
// Helper: count monthly uses for a student
// A "use" is a booking that went beyond BOOKED status OR is currently active (BOOKED).
// A CANCELLED booking that never progressed past BOOKED does NOT count.
// ────────────────────────────────────────────────
async function getMonthlyUsageCount(studentId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Count bookings that are BOOKED (active) OR have a related LaundryOrder (meaning they progressed)
  const count = await prisma.slotBooking.count({
    where: {
      studentId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      OR: [
        { status: 'BOOKED' }, // Currently active booking
        {
          // Had a laundry order created (progressed into workflow)
          laundryOrder: {
            isNot: null,
          },
        },
      ],
    },
  });

  return count;
}

// ────────────────────────────────────────────────
// GET /api/slots/available
// Returns available slots for the authenticated student's hostel
// ────────────────────────────────────────────────
export async function getAvailableSlots(
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
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const hostelId = studentProfile.hostelId;

    // Get slots from today onwards (active only)
    const today = new Date().toISOString().split('T')[0];

    const slots = await prisma.laundrySlot.findMany({
      where: {
        hostelId,
        isActive: true,
        date: { gte: today },
      },
      include: {
        _count: {
          select: {
            slotBookings: {
              where: { status: 'BOOKED' },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const result = slots
      .filter((slot) => isSlotInFuture(slot.date, slot.startTime))
      .map((slot) => {
        const bookedCount = slot._count.slotBookings;
        const availableSpots = slot.capacity - bookedCount;
        return {
          id: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: slot.capacity,
          bookedCount,
          availableSpots,
          isFull: availableSpots <= 0,
        };
      });

    return res.status(200).json({ success: true, slots: result });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/slots/my-active
// Returns the current student's active booking (status = BOOKED)
// ────────────────────────────────────────────────
export async function getMyActiveBooking(
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
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const booking = await prisma.slotBooking.findFirst({
      where: {
        studentId: studentProfile.id,
        status: 'BOOKED',
      },
      include: {
        slot: true,
        aiScan: true,
        laundryOrder: {
          include: {
            itemCount: true,
            complaint: true,
            aiScan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!booking || ['VERIFIED', 'RESOLVED'].includes(booking.laundryOrder?.status ?? '')) {
      return res.status(200).json({ success: true, booking: null });
    }

    // Determine if student can still cancel (can only cancel if BOOKED and not in processing/completed/complained)
    const orderStatus = booking.laundryOrder?.status ?? null;
    const canCancel =
      booking.status === 'BOOKED' && (!orderStatus || orderStatus === 'BOOKED');

    // Return booking info — rack/shelf/staff NEVER exposed to students
    return res.status(200).json({
      success: true,
      booking: {
        id: booking.id,
        status: booking.status,
        bookedAt: booking.bookedAt,
        // Student-visible order status (IN_PROGRESS etc.) but NOT rack/shelf/staff
        orderStatus: orderStatus,
        canCancel,
        slot: {
          id: booking.slot.id,
          date: booking.slot.date,
          startTime: booking.slot.startTime,
          endTime: booking.slot.endTime,
        },
        itemCount: booking.laundryOrder?.itemCount
          ? {
              tShirtShirtCount: booking.laundryOrder.itemCount.tShirtShirtCount,
              pantsTrackCount: booking.laundryOrder.itemCount.pantsTrackCount,
              totalCount: booking.laundryOrder.itemCount.totalCount,
            }
          : null,
        complaint: booking.laundryOrder?.complaint
          ? {
              id: booking.laundryOrder.complaint.id,
              type: booking.laundryOrder.complaint.type,
              status: booking.laundryOrder.complaint.status,
              additionalDetails: booking.laundryOrder.complaint.additionalDetails,
              createdAt: booking.laundryOrder.complaint.createdAt,
              resolvedAt: booking.laundryOrder.complaint.resolvedAt,
            }
          : null,
        aiScan: (booking.aiScan || booking.laundryOrder?.aiScan)
          ? {
              id: (booking.aiScan || booking.laundryOrder?.aiScan)!.id,
              visibleClothingCount: (booking.aiScan || booking.laundryOrder?.aiScan)!.visibleClothingCount,
              clothingType: (booking.aiScan || booking.laundryOrder?.aiScan)!.clothingType,
              mainColor: (booking.aiScan || booking.laundryOrder?.aiScan)!.mainColor,
              possibleStain: (booking.aiScan || booking.laundryOrder?.aiScan)!.possibleStain,
              stainSeverity: (booking.aiScan || booking.laundryOrder?.aiScan)!.stainSeverity,
              confidence: (booking.aiScan || booking.laundryOrder?.aiScan)!.confidence,
              washMode: (booking.aiScan || booking.laundryOrder?.aiScan)!.washMode,
              preTreatment: (booking.aiScan || booking.laundryOrder?.aiScan)!.preTreatment,
              detergentLevel: (booking.aiScan || booking.laundryOrder?.aiScan)!.detergentLevel,
              staffConfirmed: (booking.aiScan || booking.laundryOrder?.aiScan)!.staffConfirmed,
              confirmedType: (booking.aiScan || booking.laundryOrder?.aiScan)!.confirmedType,
              confirmedColor: (booking.aiScan || booking.laundryOrder?.aiScan)!.confirmedColor,
              confirmedStain: (booking.aiScan || booking.laundryOrder?.aiScan)!.confirmedStain,
              confirmedSeverity: (booking.aiScan || booking.laundryOrder?.aiScan)!.confirmedSeverity,
              confirmedRecommendation: (booking.aiScan || booking.laundryOrder?.aiScan)!.confirmedRecommendation,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// GET /api/student/usage
// Returns monthly usage info for the authenticated student
// ────────────────────────────────────────────────
export async function getStudentUsage(
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
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const usedCount = await getMonthlyUsageCount(studentProfile.id);
    const now = new Date();

    return res.status(200).json({
      success: true,
      usage: {
        usedCount,
        maxCount: MAX_MONTHLY_USES,
        remainingCount: Math.max(0, MAX_MONTHLY_USES - usedCount),
        month: now.toLocaleString('default', { month: 'long' }),
        year: now.getFullYear(),
        canBook: usedCount < MAX_MONTHLY_USES,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/slots/book
// Creates a booking for the authenticated student
// ────────────────────────────────────────────────
export async function bookSlot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const { slotId, tShirtShirtCount, pantsTrackCount, aiScanId } = req.body;

    // ── 1. Input presence check ──
    if (!slotId) {
      return res.status(400).json({ success: false, message: 'Please select a laundry slot.' });
    }
    if (tShirtShirtCount === undefined || pantsTrackCount === undefined) {
      return res.status(400).json({ success: false, message: 'Please enter a valid clothing count.' });
    }

    // ── 2. Clothing count validation ──
    const tCount = Number(tShirtShirtCount);
    const pCount = Number(pantsTrackCount);

    if (!Number.isInteger(tCount) || !Number.isInteger(pCount)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid clothing count.' });
    }
    if (tCount < 0 || pCount < 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid clothing count.' });
    }
    if (tCount > MAX_CLOTHES_PER_CATEGORY || pCount > MAX_CLOTHES_PER_CATEGORY) {
      return res.status(400).json({ success: false, message: 'Please enter a valid clothing count.' });
    }

    const totalClothes = tCount + pCount;

    if (totalClothes === 0) {
      return res.status(400).json({ success: false, message: 'Please enter at least 1 clothing item.' });
    }
    if (totalClothes > MAX_CLOTHES_TOTAL) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_CLOTHES_TOTAL} clothes are allowed per laundry submission.`,
      });
    }

    // ── 3. Get student profile & verify it exists ──
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // ── 4. Get the slot & verify it exists ──
    const slot = await prisma.laundrySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Laundry slot not found.' });
    }

    if (!slot.isActive) {
      return res.status(400).json({ success: false, message: 'This laundry slot is not available.' });
    }

    // ── 4b. Slot start time must be in future (slot start time > now) ──
    if (!isSlotInFuture(slot.date, slot.startTime)) {
      return res.status(400).json({
        success: false,
        message: 'This laundry slot start time has already passed.',
      });
    }

    // ── 5. Hostel isolation: slot must belong to student's hostel ──
    if (slot.hostelId !== studentProfile.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to book this laundry slot.',
      });
    }

    // ── 6. Monthly usage check ──
    const usedCount = await getMonthlyUsageCount(studentProfile.id);
    if (usedCount >= MAX_MONTHLY_USES) {
      return res.status(400).json({
        success: false,
        message: `You have reached your monthly laundry limit of ${MAX_MONTHLY_USES} uses.`,
      });
    }

    // ── 7. Duplicate booking check: student can't have 2 active bookings for same slot ──
    const existingBooking = await prisma.slotBooking.findFirst({
      where: {
        studentId: studentProfile.id,
        slotId,
        status: 'BOOKED',
      },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: 'You already have a booking for this laundry slot.',
      });
    }

    // Also check: student can't have more than 1 active booking at any time
    const anyActiveBooking = await prisma.slotBooking.findFirst({
      where: {
        studentId: studentProfile.id,
        status: 'BOOKED',
        OR: [
          { laundryOrder: null },
          { laundryOrder: { status: { in: ['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] } } },
        ],
      },
    });

    if (anyActiveBooking) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active laundry booking. Please cancel it before booking a new one.',
      });
    }

    // ── 8. Re-check slot capacity (race condition safety) ──
    const bookedCount = await prisma.slotBooking.count({
      where: {
        slotId,
        status: 'BOOKED',
      },
    });

    if (bookedCount >= slot.capacity) {
      return res.status(409).json({
        success: false,
        message: 'This laundry slot is full. Please choose another slot.',
      });
    }

    // ── 9. Create booking + item count atomically ──
    const result = await prisma.$transaction(async (tx) => {
      // Create the slot booking
      const booking = await tx.slotBooking.create({
        data: {
          studentId: studentProfile.id,
          slotId,
          status: 'BOOKED',
        },
      });

      // Create item count record
      const itemCount = await tx.itemCount.create({
        data: {
          tShirtShirtCount: tCount,
          pantsTrackCount: pCount,
          totalCount: totalClothes,
          isLocked: false,
        },
      });

      // Create laundry order linking both
      const laundryOrder = await tx.laundryOrder.create({
        data: {
          studentId: studentProfile.id,
          bookingId: booking.id,
          hostelId: studentProfile.hostelId,
          itemCountId: itemCount.id,
          status: 'BOOKED',
        },
      });

      // If student provided an aiScanId, link it to the booking and order
      if (aiScanId && typeof aiScanId === 'string') {
        const existingScan = await tx.aiScan.findUnique({
          where: { id: aiScanId },
        });
        if (
          existingScan &&
          existingScan.studentId === studentProfile.id &&
          existingScan.hostelId === studentProfile.hostelId
        ) {
          await tx.aiScan.update({
            where: { id: aiScanId },
            data: {
              bookingId: booking.id,
              laundryOrderId: laundryOrder.id,
            },
          });
        }
      }

      return { booking, itemCount, laundryOrder };
    });

    // Fetch the created booking with slot info for response
    const fullBooking = await prisma.slotBooking.findUnique({
      where: { id: result.booking.id },
      include: { slot: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully.',
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        bookedAt: result.booking.bookedAt,
        slot: {
          id: fullBooking!.slot.id,
          date: fullBooking!.slot.date,
          startTime: fullBooking!.slot.startTime,
          endTime: fullBooking!.slot.endTime,
        },
        itemCount: {
          tShirtShirtCount: result.itemCount.tShirtShirtCount,
          pantsTrackCount: result.itemCount.pantsTrackCount,
          totalCount: result.itemCount.totalCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// DELETE /api/slots/cancel/:id
// Cancels a BOOKED booking — ownership + status verified
// ────────────────────────────────────────────────
export async function cancelBooking(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only' });
    }

    const bookingId = req.params.id;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // Fetch the booking
    const booking = await prisma.slotBooking.findUnique({
      where: { id: bookingId },
      include: { laundryOrder: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Verify ownership
    if (booking.studentId !== studentProfile.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to access this booking.',
      });
    }

    // Can only cancel while BOOKED and NOT yet in processing
    if (booking.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled in its current status.',
      });
    }

    // Phase 3: Prevent cancellation if laundry order is IN_PROGRESS (staff already processed intake)
    if (booking.laundryOrder && booking.laundryOrder.status === 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'This laundry booking can no longer be cancelled because processing has started.',
      });
    }

    // Cancel the booking and remove the laundry order (since it never progressed)
    await prisma.$transaction(async (tx) => {
      // Update booking status to CANCELLED
      await tx.slotBooking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      // If a laundry order was created, delete it so the pre-intake cancel
      // doesn't permanently count against the monthly quota
      if (booking.laundryOrder) {
        // Also delete the item count
        if (booking.laundryOrder.itemCountId) {
          await tx.itemCount.delete({
            where: { id: booking.laundryOrder.itemCountId },
          }).catch(() => {}); // ignore if already gone
        }
        await tx.laundryOrder.delete({
          where: { id: booking.laundryOrder.id },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. The slot has been released.',
    });
  } catch (error) {
    next(error);
  }
}
