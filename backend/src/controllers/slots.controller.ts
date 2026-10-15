import { Response, NextFunction } from 'express';
import { prisma } from '../prisma.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { Role } from '../types/models.js';
import { isSlotInFuture } from '../utils/date.js';
import { planSmartBatches } from '../services/batchPlanning.service.js';
import { bookMultiBatch, MultiBatchError } from '../services/multiBatchBooking.service.js';
import { getMonthlyUsageCount } from '../utils/weekAllowance.js';

const MAX_MONTHLY_USES = 4;
const MAX_CLOTHES_TOTAL = 20;
const MAX_CLOTHES_PER_CATEGORY = 20; // per individual category sanity check

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
      include: { hostel: true },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    if (studentProfile.hostel.environment !== req.user.environment) {
      return res.status(403).json({ success: false, message: 'Access restricted: environment mismatch.' });
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

    // 1. Find the resident's active booking (status = 'BOOKED' and not completed/verified/resolved)
    const activeBooking = await prisma.slotBooking.findFirst({
      where: {
        studentId: studentProfile.id,
        status: 'BOOKED',
        OR: [
          { laundryOrder: null },
          { laundryOrder: { status: { notIn: ['VERIFIED', 'RESOLVED'] } } },
        ],
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
      orderBy: [{ batchNumber: 'asc' }, { createdAt: 'desc' }],
    });

    if (!activeBooking) {
      return res.status(200).json({ success: true, booking: null, batches: [] });
    }

    // Helper to format a booking item
    const formatBatchItem = (b: any) => {
      const orderStatus = b.laundryOrder?.status ?? null;
      const canCancel = b.status === 'BOOKED' && (!orderStatus || orderStatus === 'BOOKED');
      const scan = b.aiScan || b.laundryOrder?.aiScan || null;

      return {
        id: b.id,
        status: b.status,
        bookedAt: b.bookedAt,
        batchGroupId: b.batchGroupId,
        batchNumber: b.batchNumber,
        totalBatches: b.totalBatches,
        weightGrams: b.weightGrams,
        orderId: b.laundryOrder?.id ?? null,
        orderStatus,
        canCancel,
        slot: {
          id: b.slot.id,
          date: b.slot.date,
          startTime: b.slot.startTime,
          endTime: b.slot.endTime,
        },
        itemCount: b.laundryOrder?.itemCount
          ? {
              shirtCount: b.laundryOrder.itemCount.shirtCount,
              tshirtCount: b.laundryOrder.itemCount.tshirtCount,
              pantsCount: b.laundryOrder.itemCount.pantsCount,
              jeansCount: b.laundryOrder.itemCount.jeansCount,
              shortsCount: b.laundryOrder.itemCount.shortsCount,
              totalWeightGrams: b.laundryOrder.itemCount.totalWeightGrams,
              tShirtShirtCount: b.laundryOrder.itemCount.tShirtShirtCount,
              pantsTrackCount: b.laundryOrder.itemCount.pantsTrackCount,
              totalCount: b.laundryOrder.itemCount.totalCount,
            }
          : null,
        complaint: b.laundryOrder?.complaint
          ? {
              id: b.laundryOrder.complaint.id,
              type: b.laundryOrder.complaint.type,
              status: b.laundryOrder.complaint.status,
              additionalDetails: b.laundryOrder.complaint.additionalDetails,
              createdAt: b.laundryOrder.complaint.createdAt,
              resolvedAt: b.laundryOrder.complaint.resolvedAt,
            }
          : null,
        aiScan: scan
          ? {
              id: scan.id,
              visibleClothingCount: scan.visibleClothingCount,
              clothingType: scan.clothingType,
              mainColor: scan.mainColor,
              possibleStain: scan.possibleStain,
              stainSeverity: scan.stainSeverity,
              confidence: scan.confidence,
              washMode: scan.washMode,
              preTreatment: scan.preTreatment,
              detergentLevel: scan.detergentLevel,
              staffConfirmed: scan.staffConfirmed,
              confirmedType: scan.confirmedType,
              confirmedColor: scan.confirmedColor,
              confirmedStain: scan.confirmedStain,
              confirmedSeverity: scan.confirmedSeverity,
              confirmedRecommendation: scan.confirmedRecommendation,
            }
          : null,
      };
    };

    // 2. If part of a multi-batch group, query all batches in the group for this student
    let allBatches: any[] = [];
    if (activeBooking.batchGroupId) {
      const groupBookings = await prisma.slotBooking.findMany({
        where: {
          studentId: studentProfile.id,
          batchGroupId: activeBooking.batchGroupId,
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
        orderBy: { batchNumber: 'asc' },
      });
      allBatches = groupBookings.map(formatBatchItem);
    } else {
      allBatches = [formatBatchItem(activeBooking)];
    }

    const primaryFormatted = formatBatchItem(activeBooking);
    const isMultiBatch = (activeBooking.totalBatches ?? 1) > 1 || allBatches.length > 1;

    // Return primary booking enriched with batches array for 100% backward compatibility
    return res.status(200).json({
      success: true,
      hasActiveBooking: true,
      isMultiBatch,
      batchGroupId: activeBooking.batchGroupId ?? null,
      totalBatches: activeBooking.totalBatches ?? 1,
      booking: {
        ...primaryFormatted,
        isMultiBatch,
        batches: allBatches,
      },
      batches: allBatches,
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
      include: { hostel: true },
    });

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Laundry slot not found.' });
    }

    if (slot.hostel.environment !== req.user.environment) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: slot belongs to another environment.',
      });
    }

    // ── 5. Hostel isolation: slot must belong to student's hostel ──
    if (slot.hostelId !== studentProfile.hostelId) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to book this laundry slot.',
      });
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

    // ── 6. Execute atomic booking under resident and slot locks ──
    const result = await prisma.$transaction(async (tx) => {
      // Step A: Resident-level advisory lock (consistent lock ordering with multi-batch: Resident -> Slot)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('resident-booking-' || ${studentProfile.id})::bigint)`;

      // Step B: Monthly usage check under lock (Policy: 1 session = 1 use in current creation month)
      const usedCount = await getMonthlyUsageCount(studentProfile.id, new Date(), tx);
      if (usedCount >= MAX_MONTHLY_USES) {
        throw new Error(`MONTHLY_LIMIT_REACHED: You have reached your monthly laundry limit of ${MAX_MONTHLY_USES} uses.`);
      }

      // Step C: Duplicate booking check: student can't have 2 active bookings for same slot
      const existingBooking = await tx.slotBooking.findFirst({
        where: {
          studentId: studentProfile.id,
          slotId,
          status: 'BOOKED',
        },
      });

      if (existingBooking) {
        throw new Error('DUPLICATE_SLOT_BOOKING: You already have a booking for this laundry slot.');
      }

      // Step D: Active booking guard: student can't have more than 1 active booking at any time
      const anyActiveBooking = await tx.slotBooking.findFirst({
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
        throw new Error('ACTIVE_BOOKING_EXISTS: You already have an active laundry booking. Please cancel it before booking a new one.');
      }

      // Step E: Row-level lock on LaundrySlot to protect capacity
      await tx.$executeRaw`SELECT id FROM "LaundrySlot" WHERE id = ${slotId} FOR UPDATE`;

      const bookedCount = await tx.slotBooking.count({
        where: {
          slotId,
          status: 'BOOKED',
        },
      });

      if (bookedCount >= slot.capacity) {
        throw new Error('SLOT_FULL: This laundry slot is full. Please choose another slot.');
      }

      // Step F: Create the slot booking with recorded weight
      const estimatedWeight = (tCount * 190) + (pCount * 450);
      const booking = await tx.slotBooking.create({
        data: {
          studentId: studentProfile.id,
          slotId,
          status: 'BOOKED',
          weightGrams: estimatedWeight,
        },
      });

      // Create item count record
      const itemCount = await tx.itemCount.create({
        data: {
          tShirtShirtCount: tCount,
          pantsTrackCount: pCount,
          totalCount: totalClothes,
          totalWeightGrams: estimatedWeight,
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
  } catch (error: any) {
    if (error.message && error.message.startsWith('MONTHLY_LIMIT_REACHED:')) {
      return res.status(400).json({
        success: false,
        message: error.message.replace('MONTHLY_LIMIT_REACHED: ', ''),
      });
    }
    if (error.message && error.message.startsWith('DUPLICATE_SLOT_BOOKING:')) {
      return res.status(409).json({
        success: false,
        message: error.message.replace('DUPLICATE_SLOT_BOOKING: ', ''),
      });
    }
    if (error.message && error.message.startsWith('ACTIVE_BOOKING_EXISTS:')) {
      return res.status(409).json({
        success: false,
        message: error.message.replace('ACTIVE_BOOKING_EXISTS: ', ''),
      });
    }
    if (error.message && error.message.startsWith('SLOT_FULL:')) {
      return res.status(409).json({
        success: false,
        message: error.message.replace('SLOT_FULL: ', ''),
      });
    }
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

    // Fetch the booking with slot and hostel info for facility/environment checks
    const booking = await prisma.slotBooking.findUnique({
      where: { id: bookingId },
      include: { laundryOrder: true, slot: { include: { hostel: true } } },
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

    // Verify facility and environment isolation
    if (
      booking.slot.hostelId !== studentProfile.hostelId ||
      booking.slot.hostel.environment !== req.user.environment
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: booking facility or environment mismatch.',
      });
    }

    // Can only cancel while BOOKED and NOT yet in processing
    if (booking.status !== 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled in its current status.',
      });
    }

    // Phase 4 requirement: cancellation strictly before slot start time
    if (!isSlotInFuture(booking.slot.date, booking.slot.startTime)) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation is only permitted strictly before the slot start time.',
      });
    }

    // Prevent cancellation if laundry order is IN_PROGRESS (staff already processed intake)
    if (booking.laundryOrder && booking.laundryOrder.status === 'IN_PROGRESS') {
      return res.status(400).json({
        success: false,
        message: 'This laundry booking can no longer be cancelled because processing has started.',
      });
    }

    // Cancel the booking and update order status (preserve records and history)
    await prisma.$transaction(async (tx) => {
      // Serialize cancellation with any concurrent booking attempts for this resident
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('resident-booking-' || ${studentProfile.id})::bigint)`;

      await tx.slotBooking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      if (booking.laundryOrder) {
        await tx.laundryOrder.update({
          where: { id: booking.laundryOrder.id },
          data: {
            status: 'CANCELLED',
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Slot capacity and weekly allowance have been restored.',
    });
  } catch (error) {
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/slots/plan-batch
// Phase 3: Smart batch planning and advisory slot recommendations
// Read-only advisory calculation; zero database writes.
// ────────────────────────────────────────────────
export async function planBatchHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    const { garmentCounts, targetDate } = req.body;

    if (!garmentCounts || typeof garmentCounts !== 'object' || Array.isArray(garmentCounts)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "garmentCounts" must be an object with garment counts.',
      });
    }

    if (targetDate && typeof targetDate !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "targetDate" must be a string formatted as YYYY-MM-DD.',
      });
    }

    const planningResult = await planSmartBatches({
      studentUserId: req.user.userId,
      garmentCounts,
      targetDate,
    });

    return res.status(200).json(planningResult);
  } catch (error: any) {
    if (error.message && error.message.includes('must be a non-negative integer')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
}

// ────────────────────────────────────────────────
// POST /api/slots/book-multi-batch
// Phase 4: Atomic multi-batch booking with row locks, capacity demand aggregation,
// scheduled-week allowance checking, and idempotency protection.
// ────────────────────────────────────────────────
export async function bookMultiBatchHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    const { garmentCounts, batchSlotAssignments, idempotencyKey } = req.body;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "idempotencyKey" must be a non-empty string UUID.',
      });
    }

    if (!garmentCounts || typeof garmentCounts !== 'object' || Array.isArray(garmentCounts)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "garmentCounts" must be an object with garment counts.',
      });
    }

    if (!Array.isArray(batchSlotAssignments) || batchSlotAssignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "batchSlotAssignments" must be a non-empty array of batch-to-slot mappings.',
      });
    }

    const result = await bookMultiBatch({
      studentUserId: req.user.userId,
      garmentCounts,
      batchSlotAssignments,
      idempotencyKey: idempotencyKey.trim(),
    });

    const statusCode = result.isIdempotentReplay ? 200 : 201;
    return res.status(statusCode).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error instanceof MultiBatchError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        details: error.details,
      });
    }
    next(error);
  }
}

// ────────────────────────────────────────────────
// DELETE /api/slots/cancel-batch-group/:groupId
// Phase 4: Atomic batch-group cancellation
// All-or-nothing cancellation with strict future slot check and historical record preservation.
// ────────────────────────────────────────────────
export async function cancelBatchGroupHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || req.user.role !== Role.STUDENT) {
      return res.status(403).json({ success: false, message: 'Student access only.' });
    }

    const { groupId } = req.params;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid request: "groupId" parameter is required.',
      });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: req.user.userId },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const bookings = await prisma.slotBooking.findMany({
      where: { batchGroupId: groupId },
      include: {
        slot: {
          include: {
            hostel: true,
          },
        },
        laundryOrder: true,
      },
      orderBy: { batchNumber: 'asc' },
    });

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Batch group not found.',
      });
    }

    // Verify ownership
    const nonOwned = bookings.find((b) => b.studentId !== studentProfile.id);
    if (nonOwned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own all bookings in this batch group.',
      });
    }

    // Verify environment and facility isolation
    const isolationMismatch = bookings.find(
      (b) =>
        b.slot.hostelId !== studentProfile.hostelId ||
        b.slot.hostel.environment !== req.user!.environment
    );
    if (isolationMismatch) {
      return res.status(403).json({
        success: false,
        message: 'Access restricted: booking facility or environment mismatch.',
      });
    }

    // Check if entire group is already cancelled
    const activeBookings = bookings.filter((b) => b.status !== 'CANCELLED');
    if (activeBookings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All bookings in this batch group have already been cancelled.',
      });
    }

    // Validate every active booking's eligibility for cancellation (all-or-nothing)
    for (const b of activeBookings) {
      if (b.status !== 'BOOKED') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel batch group: batch ${b.batchNumber} has status "${b.status}".`,
        });
      }

      // Must be strictly before slot start time
      if (!isSlotInFuture(b.slot.date, b.slot.startTime)) {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel batch group: batch ${b.batchNumber} slot start time has already arrived or passed.`,
        });
      }

      // Check if order is already being processed
      if (b.laundryOrder && b.laundryOrder.status === 'IN_PROGRESS') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel batch group: batch ${b.batchNumber} is already in progress.`,
        });
      }
    }

    // Atomic cancellation in transaction
    await prisma.$transaction(async (tx) => {
      // Serialize cancellation with any concurrent booking attempts for this resident
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('resident-booking-' || ${studentProfile.id})::bigint)`;

      const now = new Date();
      const activeBookingIds = activeBookings.map((b) => b.id);
      const activeOrderIds = activeBookings
        .map((b) => b.laundryOrder?.id)
        .filter((id): id is string => typeof id === 'string');

      await tx.slotBooking.updateMany({
        where: { id: { in: activeBookingIds } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
      });

      if (activeOrderIds.length > 0) {
        await tx.laundryOrder.updateMany({
          where: { id: { in: activeOrderIds } },
          data: {
            status: 'CANCELLED',
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: `Batch group ${groupId} cancelled successfully. Slot capacity and weekly allowance have been restored.`,
      batchGroupId: groupId,
      cancelledBatches: activeBookings.length,
      totalBatches: bookings.length,
    });
  } catch (error) {
    next(error);
  }
}


