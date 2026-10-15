/**
 * WASHWISE Multi-Batch Booking Service (Phase 4)
 * 
 * Executes atomic multi-batch bookings within a single interactive transaction.
 * Features:
 * - Server-side garment recalculation and deterministic batch planning.
 * - Scheduled-week allowance enforcement in Asia/Kolkata IST.
 * - Idempotency key protection against duplicate submissions.
 * - Row-level locking on LaundrySlot rows with deadlock-prevention ordering.
 * - Intra-transaction slot capacity aggregation (handling multiple batches targeting the same slot).
 * - Single atomic transaction: 100% all-or-none rollback.
 * - Full preservation of historical data and existing isolation rules.
 */

import { prisma } from '../prisma.js';
import { isSlotInFuture } from '../utils/date.js';
import {
  GarmentCountsInput,
  calculateGarmentWeight,
  planBatches,
  ApprovedGarmentType,
  SESSION_MAX_WEIGHT_GRAMS,
  WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS,
} from '../utils/weight.js';
import { getScheduledWeekBoundaries, getMonthlyUsageCount } from '../utils/weekAllowance.js';

export const MAX_MONTHLY_USES = 4;

export class MultiBatchError extends Error {
  statusCode: number;
  details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.name = 'MultiBatchError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface BatchSlotAssignment {
  batchNumber: number;
  slotId: string;
}

export interface MultiBatchBookingParams {
  studentUserId: string;
  garmentCounts: GarmentCountsInput;
  batchSlotAssignments: BatchSlotAssignment[];
  idempotencyKey: string;
}

export interface BookedBatchItem {
  id: string;
  batchNumber: number;
  totalBatches: number;
  weightGrams: number;
  status: string;
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  };
  garmentCounts: Record<ApprovedGarmentType, number>;
}

export interface MultiBatchBookingResult {
  isIdempotentReplay: boolean;
  batchGroupId: string;
  totalBatches: number;
  totalWeightGrams: number;
  bookings: BookedBatchItem[];
  message: string;
}

/**
 * Validates and atomically books multiple batches for a student.
 */
export async function bookMultiBatch({
  studentUserId,
  garmentCounts,
  batchSlotAssignments,
  idempotencyKey,
}: MultiBatchBookingParams): Promise<MultiBatchBookingResult> {
  // ── 1. Basic validation of parameters ──
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    throw new MultiBatchError(400, 'A valid idempotency key is required.');
  }

  if (!garmentCounts || typeof garmentCounts !== 'object' || Array.isArray(garmentCounts)) {
    throw new MultiBatchError(400, 'Invalid request: "garmentCounts" must be an object.');
  }

  if (!Array.isArray(batchSlotAssignments) || batchSlotAssignments.length === 0) {
    throw new MultiBatchError(400, 'Invalid request: "batchSlotAssignments" must be a non-empty array.');
  }

  // ── 2. Resident and facility authorization ──
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: {
      hostel: true,
      user: true,
    },
  });

  if (!student || !student.user || !student.user.isActive) {
    throw new MultiBatchError(404, 'Student profile not found or user account is inactive.');
  }

  if (student.hostel.environment !== student.user.environment) {
    throw new MultiBatchError(403, 'Environment mismatch between resident and assigned facility.');
  }

  // ── 3. Server-side weight calculation and deterministic batching ──
  const weightCalc = calculateGarmentWeight(garmentCounts);

  if (weightCalc.requiresReview) {
    throw new MultiBatchError(
      400,
      `Cannot book: ${weightCalc.unresolvedItems.length} item(s) require review or classification first.`
    );
  }

  if (weightCalc.totalApprovedWeightGrams === 0) {
    throw new MultiBatchError(400, 'Cannot book: garment count must total at least 1 item.');
  }

  const batchPlan = planBatches(garmentCounts);

  if (batchPlan.unbatchableGarments && batchPlan.unbatchableGarments.length > 0) {
    throw new MultiBatchError(
      400,
      `Cannot book: garments exceed maximum session limit of ${SESSION_MAX_WEIGHT_GRAMS}g.`
    );
  }

  // Verify batch assignment alignment
  if (batchSlotAssignments.length !== batchPlan.totalBatches) {
    throw new MultiBatchError(
      400,
      `Batch assignments mismatch: expected ${batchPlan.totalBatches} slot assignment(s), received ${batchSlotAssignments.length}.`
    );
  }

  // Check that every batch number 1..totalBatches is present exactly once
  const assignedBatchNumbers = batchSlotAssignments.map((a) => a.batchNumber);
  const uniqueBatchNumbers = new Set(assignedBatchNumbers);
  if (uniqueBatchNumbers.size !== batchPlan.totalBatches) {
    throw new MultiBatchError(400, 'Duplicate or missing batch numbers in slot assignments.');
  }

  for (let i = 1; i <= batchPlan.totalBatches; i++) {
    if (!uniqueBatchNumbers.has(i)) {
      throw new MultiBatchError(400, `Missing slot assignment for Batch ${i}.`);
    }
  }

  // ── 4. Verify all slots belong to student facility and are in future ──
  const uniqueSlotIds = Array.from(new Set(batchSlotAssignments.map((a) => a.slotId)));
  const slotsFromDb = await prisma.laundrySlot.findMany({
    where: { id: { in: uniqueSlotIds } },
    include: { hostel: true },
  });

  if (slotsFromDb.length !== uniqueSlotIds.length) {
    throw new MultiBatchError(404, 'One or more selected laundry slots were not found.');
  }

  for (const slot of slotsFromDb) {
    if (slot.hostelId !== student.hostelId) {
      throw new MultiBatchError(403, `Slot ${slot.id} does not belong to your assigned facility (${student.hostel.name}).`);
    }
    if (slot.hostel.environment !== student.user.environment) {
      throw new MultiBatchError(403, 'Cross-environment slot booking is strictly prohibited.');
    }
    if (!slot.isActive) {
      throw new MultiBatchError(400, `Slot ${slot.date} (${slot.startTime}–${slot.endTime}) is inactive.`);
    }
    if (!isSlotInFuture(slot.date, slot.startTime)) {
      throw new MultiBatchError(400, `Slot ${slot.date} (${slot.startTime}–${slot.endTime}) start time has already passed.`);
    }
  }

  // ── 5. Pre-validate weekly allowance (Option B IST scheduled week) ──
  // Group batch weights by the scheduled week of their target slot
  const weightByWeek: Record<string, { weekStartDateStr: string; weekEndDateStr: string; proposedWeight: number; weekLabel: string }> = {};

  for (const assignment of batchSlotAssignments) {
    const batch = batchPlan.batches.find((b) => b.batchNumber === assignment.batchNumber)!;
    const slot = slotsFromDb.find((s) => s.id === assignment.slotId)!;
    const week = getScheduledWeekBoundaries(slot.date);

    if (!weightByWeek[week.weekStartDateStr]) {
      weightByWeek[week.weekStartDateStr] = {
        weekStartDateStr: week.weekStartDateStr,
        weekEndDateStr: week.weekEndDateStr,
        proposedWeight: 0,
        weekLabel: week.weekLabel,
      };
    }
    weightByWeek[week.weekStartDateStr].proposedWeight += batch.weightGrams;
  }

  // ── 6. Execute atomic transaction with concurrency safeguards ──
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      // A. Distributed transaction-scoped advisory lock using idempotency key hash
      // Prevents concurrent duplicate submissions across multiple backend processes
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey})::bigint)`;

      // B. Resident-level advisory lock: strictly serializes all booking-limit checks for this resident
      // Lock ordering protocol: Idempotency Key -> Resident ID -> Slot IDs (ascending)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('resident-booking-' || ${student.id})::bigint)`;

      // C. Idempotency Check: check if this idempotencyKey has already completed
      const existingGroup = await tx.slotBooking.findMany({
        where: { batchGroupId: idempotencyKey },
        include: {
          slot: true,
          laundryOrder: {
            include: {
              itemCount: true,
            },
          },
        },
        orderBy: { batchNumber: 'asc' },
      });

      if (existingGroup.length > 0) {
        // 1. Resident identity comparison
        const isSameStudent = existingGroup[0].studentId === student.id;
        if (!isSameStudent) {
          throw new MultiBatchError(
            409,
            'Idempotency key was previously used by another resident.'
          );
        }

        // 2. Batch count comparison
        const isSameCount = existingGroup.length === batchPlan.totalBatches;

        // 3. Weight comparison
        const existingTotalWeight = existingGroup.reduce((sum, b) => sum + (b.weightGrams || 0), 0);
        const isSameWeight = existingTotalWeight === batchPlan.totalWeightGrams;

        // 4. Slot assignments comparison (exact batchNumber -> slotId match)
        let isSameSlotAssignments = true;
        if (isSameCount) {
          for (const b of existingGroup) {
            const requested = batchSlotAssignments.find((a) => a.batchNumber === b.batchNumber);
            if (!requested || requested.slotId !== b.slotId) {
              isSameSlotAssignments = false;
              break;
            }
          }
        } else {
          isSameSlotAssignments = false;
        }

        // 5. Garment counts comparison (aggregating ItemCount records across existing batches)
        let isSameGarmentCounts = true;
        if (isSameCount && isSameSlotAssignments && isSameWeight) {
          const aggregatedCounts: Record<ApprovedGarmentType, number> = {
            shirt: 0,
            tshirt: 0,
            pants: 0,
            jeans: 0,
            shorts: 0,
          };
          for (const b of existingGroup) {
            const ic = b.laundryOrder?.itemCount;
            if (ic) {
              aggregatedCounts.shirt += ic.shirtCount || 0;
              aggregatedCounts.tshirt += ic.tshirtCount || 0;
              aggregatedCounts.pants += ic.pantsCount || 0;
              aggregatedCounts.jeans += ic.jeansCount || 0;
              aggregatedCounts.shorts += ic.shortsCount || 0;
            }
          }

          const reqShirt = garmentCounts.shirt || 0;
          const reqTshirt = garmentCounts.tshirt || 0;
          const reqPants = garmentCounts.pants || 0;
          const reqJeans = garmentCounts.jeans || 0;
          const reqShorts = garmentCounts.shorts || 0;

          if (
            aggregatedCounts.shirt !== reqShirt ||
            aggregatedCounts.tshirt !== reqTshirt ||
            aggregatedCounts.pants !== reqPants ||
            aggregatedCounts.jeans !== reqJeans ||
            aggregatedCounts.shorts !== reqShorts
          ) {
            isSameGarmentCounts = false;
          }
        } else {
          isSameGarmentCounts = false;
        }

        if (!isSameCount || !isSameWeight || !isSameSlotAssignments || !isSameGarmentCounts) {
          throw new MultiBatchError(
            409,
            'Idempotency key was previously used for a different booking request.'
          );
        }

        // Return existing booking without duplicate inserts (Idempotent 200)
        return {
          isIdempotentReplay: true,
          batchGroupId: idempotencyKey,
          totalBatches: existingGroup.length,
          totalWeightGrams: existingTotalWeight,
          bookings: existingGroup.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            totalBatches: b.totalBatches,
            weightGrams: b.weightGrams || 0,
            status: b.status,
            slot: {
              id: b.slot.id,
              date: b.slot.date,
              startTime: b.slot.startTime,
              endTime: b.slot.endTime,
            },
            garmentCounts: b.laundryOrder?.itemCount
              ? {
                  shirt: b.laundryOrder.itemCount.shirtCount,
                  tshirt: b.laundryOrder.itemCount.tshirtCount,
                  pants: b.laundryOrder.itemCount.pantsCount,
                  jeans: b.laundryOrder.itemCount.jeansCount,
                  shorts: b.laundryOrder.itemCount.shortsCount,
                }
              : ({} as Record<ApprovedGarmentType, number>),
          })),
          message: 'Idempotent replay: existing booking retrieved successfully.',
        };
      }

      // D. Check monthly usage limit under resident-level lock (Policy: 1 multi-batch session = 1 monthly use in current creation month)
      const currentMonthlyUses = await getMonthlyUsageCount(student.id, new Date(), tx);
      if (currentMonthlyUses >= MAX_MONTHLY_USES) {
        throw new MultiBatchError(
          400,
          `You have reached your monthly laundry limit of ${MAX_MONTHLY_USES} uses.`
        );
      }

      // E. Check active booking guard: student cannot hold pending active bookings from another session
      const existingActiveBooking = await tx.slotBooking.findFirst({
        where: {
          studentId: student.id,
          status: 'BOOKED',
          OR: [
            { batchGroupId: null },
            { batchGroupId: { not: idempotencyKey } },
          ],
          AND: [
            {
              OR: [
                { laundryOrder: null },
                { laundryOrder: { status: { notIn: ['VERIFIED', 'RESOLVED'] } } },
              ],
            },
          ],
        },
      });

      if (existingActiveBooking) {
        throw new MultiBatchError(
          409,
          'You already have an active laundry booking. Please complete or cancel it before booking a new load.'
        );
      }

      // F. Acquire row-level locks on target slots in consistent ascending order to prevent deadlocks
      const sortedSlotIds = [...uniqueSlotIds].sort();
      for (const slotId of sortedSlotIds) {
        await tx.$executeRaw`SELECT id FROM "LaundrySlot" WHERE id = ${slotId} FOR UPDATE`;
      }

      // E. Recheck slot capacity inside the transaction lock
      // Group demand by slot (two batches targeting the same slot consume 2 capacity units!)
      const demandBySlot: Record<string, number> = {};
      for (const assignment of batchSlotAssignments) {
        demandBySlot[assignment.slotId] = (demandBySlot[assignment.slotId] || 0) + 1;
      }

      for (const [slotId, demand] of Object.entries(demandBySlot)) {
        const lockedSlot = await tx.laundrySlot.findUnique({
          where: { id: slotId },
        });

        if (!lockedSlot || !lockedSlot.isActive) {
          throw new MultiBatchError(400, `Laundry slot ${slotId} is no longer active.`);
        }

        if (!isSlotInFuture(lockedSlot.date, lockedSlot.startTime)) {
          throw new MultiBatchError(400, `Slot start time (${lockedSlot.date} ${lockedSlot.startTime}) has already passed.`);
        }

        const bookedCount = await tx.slotBooking.count({
          where: { slotId, status: 'BOOKED' },
        });

        const availableSpots = lockedSlot.capacity - bookedCount;
        if (demand > availableSpots) {
          throw new MultiBatchError(
            409,
            `Slot ${lockedSlot.date} (${lockedSlot.startTime}–${lockedSlot.endTime}) does not have enough capacity. Needed: ${demand}, Available: ${availableSpots}.`
          );
        }
      }

      // F. Recheck weekly allowance under concurrency protection
      for (const [_, weekData] of Object.entries(weightByWeek)) {
        const activeBookingsInWeek = await tx.slotBooking.findMany({
          where: {
            studentId: student.id,
            status: { not: 'CANCELLED' },
            slot: {
              date: {
                gte: weekData.weekStartDateStr,
                lte: weekData.weekEndDateStr,
              },
            },
          },
        });

        let committedWeight = 0;
        let legacyCount = 0;

        for (const b of activeBookingsInWeek) {
          if (b.weightGrams === null || b.weightGrams === undefined) {
            legacyCount++;
          } else {
            committedWeight += b.weightGrams;
          }
        }

        if (legacyCount > 0) {
          throw new MultiBatchError(
            400,
            `Scheduled week contains ${legacyCount} legacy booking(s) without recorded weight. Allowance cannot be verified.`
          );
        }

        const projectedTotal = committedWeight + weekData.proposedWeight;
        if (projectedTotal > WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS) {
          throw new MultiBatchError(
            400,
            `Proposed load exceeds weekly allowance of ${WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS}g for ${weekData.weekLabel}. Currently committed: ${committedWeight}g, proposed: ${weekData.proposedWeight}g.`
          );
        }
      }

      // G. Atomically create SlotBooking, ItemCount, and LaundryOrder for all batches
      const createdBookings: BookedBatchItem[] = [];

      for (const batch of batchPlan.batches) {
        const assignment = batchSlotAssignments.find((a) => a.batchNumber === batch.batchNumber)!;

        const slotBooking = await tx.slotBooking.create({
          data: {
            studentId: student.id,
            slotId: assignment.slotId,
            status: 'BOOKED',
            batchGroupId: idempotencyKey,
            batchNumber: batch.batchNumber,
            totalBatches: batchPlan.totalBatches,
            weightGrams: batch.weightGrams,
          },
          include: { slot: true },
        });

        const tShirtShirtCount = batch.garmentCounts.shirt + batch.garmentCounts.tshirt;
        const pantsTrackCount =
          batch.garmentCounts.pants + batch.garmentCounts.jeans + batch.garmentCounts.shorts;

        const itemCount = await tx.itemCount.create({
          data: {
            shirtCount: batch.garmentCounts.shirt,
            tshirtCount: batch.garmentCounts.tshirt,
            pantsCount: batch.garmentCounts.pants,
            jeansCount: batch.garmentCounts.jeans,
            shortsCount: batch.garmentCounts.shorts,
            tShirtShirtCount,
            pantsTrackCount,
            totalCount: batch.itemCount,
            totalWeightGrams: batch.weightGrams,
            isLocked: false,
          },
        });

        await tx.laundryOrder.create({
          data: {
            studentId: student.id,
            bookingId: slotBooking.id,
            hostelId: student.hostelId,
            itemCountId: itemCount.id,
            status: 'BOOKED',
          },
        });

        createdBookings.push({
          id: slotBooking.id,
          batchNumber: slotBooking.batchNumber,
          totalBatches: slotBooking.totalBatches,
          weightGrams: slotBooking.weightGrams ?? batch.weightGrams,
          status: slotBooking.status,
          slot: {
            id: slotBooking.slot.id,
            date: slotBooking.slot.date,
            startTime: slotBooking.slot.startTime,
            endTime: slotBooking.slot.endTime,
          },
          garmentCounts: batch.garmentCounts,
        });
      }

      return {
        isIdempotentReplay: false,
        batchGroupId: idempotencyKey,
        totalBatches: batchPlan.totalBatches,
        totalWeightGrams: batchPlan.totalWeightGrams,
        bookings: createdBookings,
        message: 'All batches booked successfully in a single atomic transaction.',
      };
    },
    {
      timeout: 30000,
      maxWait: 10000,
    }
  );

  return transactionResult;
}
