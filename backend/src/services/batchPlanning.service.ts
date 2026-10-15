/**
 * WASHWISE Smart Batch Planning and Advisory Slot Recommendation Service
 * 
 * Advisory only: zero database mutations or reservations.
 * Strictly respects resident facility assignment and environment isolation.
 */

import { prisma } from '../prisma.js';
import { isSlotInFuture } from '../utils/date.js';
import {
  GarmentCountsInput,
  calculateGarmentWeight,
  planBatches,
  WeightCalculationResult,
  BatchPlanResult,
  BatchPlanItem,
  SESSION_MAX_WEIGHT_GRAMS,
} from '../utils/weight.js';
import {
  getResidentWeeklyAllowance,
  getScheduledWeekBoundaries,
  WeeklyAllowanceStatus,
} from '../utils/weekAllowance.js';

export interface RecommendedSlot {
  slotId: string;
  hostelId: string;
  hostelName: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  availableSpots: number;
  scheduledWeekLabel: string;
}

export interface BatchRecommendation {
  batch: BatchPlanItem;
  recommendedSlots: RecommendedSlot[];
  hasAvailableSlots: boolean;
}

export interface SmartPlanningResponse {
  success: boolean;
  planningStatus: 'CONFIRMED' | 'REQUIRES_REVIEW' | 'EXCEEDS_ALLOWANCE' | 'NO_SLOTS' | 'UNBATCHABLE' | 'EMPTY';
  weightCalculation: WeightCalculationResult;
  batchPlan?: BatchPlanResult;
  weeklyAllowance: WeeklyAllowanceStatus;
  batchRecommendations: BatchRecommendation[];
  warnings: string[];
  isActionable: boolean;
  facility: {
    id: string;
    name: string;
    environment: string;
  };
}

export interface SmartPlanningParams {
  studentUserId: string;
  garmentCounts: GarmentCountsInput;
  targetDate?: string; // Optional target date YYYY-MM-DD
}

export async function planSmartBatches({
  studentUserId,
  garmentCounts,
  targetDate,
}: SmartPlanningParams): Promise<SmartPlanningResponse> {
  // 1. Authenticated Student & Facility Validation
  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUserId },
    include: {
      hostel: true,
      user: true,
    },
  });

  if (!student) {
    throw new Error('Student profile not found for user.');
  }

  const facility = {
    id: student.hostel.id,
    name: student.hostel.name,
    environment: student.hostel.environment,
  };

  const warnings: string[] = [];

  // Determine reference date in IST if not provided
  let refDateStr = targetDate;
  if (!refDateStr) {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(Date.now() + istOffsetMs);
    refDateStr = istNow.toISOString().split('T')[0];
  }

  // 2. Weight Calculation
  const weightCalculation = calculateGarmentWeight(garmentCounts);

  if (weightCalculation.requiresReview) {
    for (const item of weightCalculation.unresolvedItems) {
      warnings.push(item.reason);
    }
  }

  // 3. Weekly Allowance Check
  const weeklyAllowance = await getResidentWeeklyAllowance(
    student.id,
    refDateStr,
    weightCalculation.totalApprovedWeightGrams
  );

  if (weeklyAllowance.warning) {
    warnings.push(weeklyAllowance.warning);
  }

  // If review is required, we cannot produce a confirmed batch plan
  if (weightCalculation.requiresReview) {
    return {
      success: true,
      planningStatus: 'REQUIRES_REVIEW',
      weightCalculation,
      weeklyAllowance,
      batchRecommendations: [],
      warnings,
      isActionable: false,
      facility,
    };
  }

  // Handle empty load
  if (weightCalculation.totalApprovedWeightGrams === 0) {
    return {
      success: true,
      planningStatus: 'EMPTY',
      weightCalculation,
      batchPlan: {
        totalWeightGrams: 0,
        totalBatches: 0,
        batches: [],
        isConfirmed: true,
      },
      weeklyAllowance,
      batchRecommendations: [],
      warnings: ['No garments selected for laundry planning.'],
      isActionable: false,
      facility,
    };
  }

  // 4. Batch Planning
  const batchPlan = planBatches(garmentCounts);

  if (batchPlan.unbatchableGarments && batchPlan.unbatchableGarments.length > 0) {
    warnings.push(
      `Load contains garment(s) exceeding session limit of ${SESSION_MAX_WEIGHT_GRAMS}g: ${batchPlan.unbatchableGarments
        .map((u) => `${u.className} (${u.weightGrams}g)`)
        .join(', ')}`
    );

    return {
      success: true,
      planningStatus: 'UNBATCHABLE',
      weightCalculation,
      batchPlan,
      weeklyAllowance,
      batchRecommendations: [],
      warnings,
      isActionable: false,
      facility,
    };
  }

  // 5. Check if load exceeds weekly allowance
  if (weeklyAllowance.isReliable && !weeklyAllowance.fitsWithinAllowance) {
    warnings.push(
      `Total weight (${weightCalculation.totalApprovedWeightGrams}g) exceeds resident's available weekly allowance (${weeklyAllowance.remainingAllowanceGrams}g remaining of 7,000g).`
    );
  }

  // 6. Advisory Slot Recommendations
  // Retrieve future active slots exclusively for the student's assigned facility & environment
  const availableSlotsRaw = await prisma.laundrySlot.findMany({
    where: {
      hostelId: student.hostelId,
      isActive: true,
      date: { gte: refDateStr },
    },
    include: {
      hostel: true,
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

  const validFutureSlots: RecommendedSlot[] = availableSlotsRaw
    .filter((s) => isSlotInFuture(s.date, s.startTime))
    .map((s) => {
      const bookedCount = s._count.slotBookings;
      const availableSpots = Math.max(0, s.capacity - bookedCount);
      const weekBoundaries = getScheduledWeekBoundaries(s.date);

      return {
        slotId: s.id,
        hostelId: s.hostelId,
        hostelName: s.hostel.name,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        availableSpots,
        scheduledWeekLabel: weekBoundaries.weekLabel,
      };
    })
    .filter((s) => s.availableSpots > 0);

  // Group recommended slots for each planned batch
  const batchRecommendations: BatchRecommendation[] = batchPlan.batches.map((batch, idx) => {
    // Recommend slots from available spots
    // For batch idx, if we have enough slots, distribute them advisory-wise
    return {
      batch,
      recommendedSlots: validFutureSlots,
      hasAvailableSlots: validFutureSlots.length > 0,
    };
  });

  const hasAnyUnavailableBatch = batchRecommendations.some((br) => !br.hasAvailableSlots);
  if (hasAnyUnavailableBatch) {
    warnings.push('No available upcoming slots found in your assigned facility for one or more batches.');
  }

  let planningStatus: SmartPlanningResponse['planningStatus'] = 'CONFIRMED';
  if (weeklyAllowance.isReliable && !weeklyAllowance.fitsWithinAllowance) {
    planningStatus = 'EXCEEDS_ALLOWANCE';
  } else if (hasAnyUnavailableBatch) {
    planningStatus = 'NO_SLOTS';
  }

  const isActionable =
    planningStatus === 'CONFIRMED' &&
    (!weeklyAllowance.hasLegacyUnweightedBookings || weeklyAllowance.fitsWithinAllowance);

  return {
    success: true,
    planningStatus,
    weightCalculation,
    batchPlan,
    weeklyAllowance,
    batchRecommendations,
    warnings,
    isActionable,
    facility,
  };
}
