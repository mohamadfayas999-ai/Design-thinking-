/**
 * WASHWISE Weekly Allowance and Scheduled-Week Calculation Utility (Asia/Kolkata IST)
 * 
 * Rules:
 * - Maximum allowance: 7,000 g per resident per scheduled week
 * - Week boundary: Monday 00:00:00 IST to Sunday 23:59:59.999 IST
 * - Policy: Option B — Scheduled-week allowance (based on slot date/time in Asia/Kolkata)
 * - Safe handling of legacy bookings with missing weights
 */

import { prisma } from '../prisma.js';
import { WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS } from './weight.js';

export interface ScheduledWeekInfo {
  weekStartDateStr: string; // YYYY-MM-DD (Monday)
  weekEndDateStr: string;   // YYYY-MM-DD (Sunday)
  weekStartIstIso: string;  // ISO UTC timestamp corresponding to Monday 00:00:00 IST
  weekEndIstIso: string;    // ISO UTC timestamp corresponding to Sunday 23:59:59.999 IST
  weekLabel: string;        // Human-readable label
  slotDateStr: string;      // The target slot date
}

export interface WeeklyAllowanceStatus {
  scheduledWeek: ScheduledWeekInfo;
  maxWeeklyAllowanceGrams: number;
  committedWeightGrams: number;
  remainingAllowanceGrams: number;
  proposedWeightGrams: number;
  projectedTotalWeightGrams: number;
  fitsWithinAllowance: boolean;
  isReliable: boolean;
  hasLegacyUnweightedBookings: boolean;
  legacyUnweightedBookingCount: number;
  warning?: string;
  activeBookingCount: number;
}

/**
 * Calculates the Monday-to-Sunday scheduled week boundaries for a given date in Asia/Kolkata timezone.
 * India Standard Time (IST) is permanently UTC+05:30 with no daylight saving time.
 */
export function getScheduledWeekBoundaries(dateStrOrObj: string | Date): ScheduledWeekInfo {
  let targetDateStr: string;

  if (typeof dateStrOrObj === 'string') {
    // If it's already YYYY-MM-DD or contains date part
    targetDateStr = dateStrOrObj.split('T')[0].trim();
  } else {
    // Convert Date to IST date string
    // IST is UTC + 5h30m (330 minutes)
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(dateStrOrObj.getTime() + istOffsetMs);
    targetDateStr = istDate.toISOString().split('T')[0];
  }

  const [yearStr, monthStr, dayStr] = targetDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format for scheduled week calculation: "${dateStrOrObj}". Expected YYYY-MM-DD.`);
  }

  // Use UTC day-of-week for the calendar date
  const dateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const dayOfWeek = dateUtc.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate offset to Monday (1)
  // If Sunday (0), Monday was 6 days ago (-6)
  // If Monday (1), offset is 0
  // If Tuesday (2), offset is -1, etc.
  const diffToMondayDays = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayUtc = new Date(dateUtc.getTime() + diffToMondayDays * 86400000);
  const sundayUtc = new Date(mondayUtc.getTime() + 6 * 86400000);

  const weekStartDateStr = mondayUtc.toISOString().split('T')[0];
  const weekEndDateStr = sundayUtc.toISOString().split('T')[0];

  // In IST, Monday 00:00:00.000 is UTC (Monday 00:00:00 - 5h30m) = Sunday 18:30:00.000 UTC
  const [mYear, mMonth, mDay] = weekStartDateStr.split('-').map(Number);
  const mondayIstZeroUtcMs = Date.UTC(mYear, mMonth - 1, mDay, 0, 0, 0, 0) - (5.5 * 3600 * 1000);
  const weekStartIstIso = new Date(mondayIstZeroUtcMs).toISOString();

  // In IST, Sunday 23:59:59.999 is next Monday 00:00:00.000 - 1ms
  const nextMondayIstZeroUtcMs = mondayIstZeroUtcMs + (7 * 86400000);
  const weekEndIstIso = new Date(nextMondayIstZeroUtcMs - 1).toISOString();

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const startFormatted = formatter.format(mondayUtc);
  const endFormatted = formatter.format(sundayUtc);
  const weekLabel = `Week of ${startFormatted} – ${endFormatted}`;

  return {
    weekStartDateStr,
    weekEndDateStr,
    weekStartIstIso,
    weekEndIstIso,
    weekLabel,
    slotDateStr: targetDateStr,
  };
}

/**
 * Read-only allowance calculation service for a resident and scheduled week.
 * Inspects committed weight from reliable records and safely handles legacy unweighted bookings.
 */
export async function getResidentWeeklyAllowance(
  studentId: string,
  targetSlotDateStr: string,
  proposedWeightGrams: number = 0
): Promise<WeeklyAllowanceStatus> {
  const scheduledWeek = getScheduledWeekBoundaries(targetSlotDateStr);

  // Fetch all active (non-cancelled) bookings for this student in this scheduled week
  const bookings = await prisma.slotBooking.findMany({
    where: {
      studentId,
      status: { not: 'CANCELLED' },
      slot: {
        date: {
          gte: scheduledWeek.weekStartDateStr,
          lte: scheduledWeek.weekEndDateStr,
        },
      },
    },
    include: {
      slot: true,
    },
  });

  let committedWeightGrams = 0;
  let legacyUnweightedBookingCount = 0;

  for (const booking of bookings) {
    if (booking.weightGrams === null || booking.weightGrams === undefined) {
      legacyUnweightedBookingCount++;
    } else {
      committedWeightGrams += booking.weightGrams;
    }
  }

  const hasLegacyUnweightedBookings = legacyUnweightedBookingCount > 0;
  const isReliable = !hasLegacyUnweightedBookings;

  const remainingAllowanceGrams = Math.max(
    0,
    WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS - committedWeightGrams
  );

  const projectedTotalWeightGrams = committedWeightGrams + proposedWeightGrams;
  const fitsWithinAllowance = isReliable
    ? projectedTotalWeightGrams <= WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS
    : false;

  let warning: string | undefined;
  if (hasLegacyUnweightedBookings) {
    warning = `Scheduled week contains ${legacyUnweightedBookingCount} legacy booking(s) without recorded weight. Allowance cannot be reliably confirmed without manual classification.`;
  } else if (!fitsWithinAllowance && proposedWeightGrams > 0) {
    warning = `Proposed load (${proposedWeightGrams}g) exceeds remaining weekly allowance (${remainingAllowanceGrams}g of ${WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS}g limit).`;
  }

  return {
    scheduledWeek,
    maxWeeklyAllowanceGrams: WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS,
    committedWeightGrams,
    remainingAllowanceGrams,
    proposedWeightGrams,
    projectedTotalWeightGrams,
    fitsWithinAllowance,
    isReliable,
    hasLegacyUnweightedBookings,
    legacyUnweightedBookingCount,
    warning,
    activeBookingCount: bookings.length,
  };
}

/**
 * Calculates monthly usage count for a resident using the policy:
 * ONE confirmed laundry session = ONE monthly use, regardless of the number of batches in that session.
 * A confirmed booking session counts against the calendar month in which the session was created (Asia/Kolkata IST).
 * Single-slot bookings (batchGroupId IS NULL) each count as 1 use.
 * Multi-batch groups (with a non-null batchGroupId) each count as 1 use for the entire group.
 * Cancelled bookings and cancelled groups are strictly excluded.
 */
export async function getMonthlyUsageCount(
  studentId: string,
  nowOrReferenceDate: Date = new Date(),
  client: any = prisma
): Promise<number> {
  // Convert reference date to Asia/Kolkata (IST = UTC + 5h30m)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(nowOrReferenceDate.getTime() + istOffsetMs);
  const istYear = istDate.getUTCFullYear();
  const istMonth = istDate.getUTCMonth(); // 0-indexed

  // Month boundary in IST:
  // Start: 1st of month at 00:00:00.000 IST => UTC = IST - 5h30m
  const startOfMonthUtcMs = Date.UTC(istYear, istMonth, 1, 0, 0, 0, 0) - istOffsetMs;
  const startOfMonth = new Date(startOfMonthUtcMs);

  // End: 1st of next month at 00:00:00.000 IST - 1 ms
  const nextMonthIstUtcMs = Date.UTC(istYear, istMonth + 1, 1, 0, 0, 0, 0) - istOffsetMs;
  const endOfMonth = new Date(nextMonthIstUtcMs - 1);

  const bookings = await client.slotBooking.findMany({
    where: {
      studentId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      status: { not: 'CANCELLED' },
      OR: [
        { status: 'BOOKED' },
        {
          laundryOrder: {
            status: { in: ['IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW', 'VERIFIED'] },
          },
        },
      ],
    },
    select: {
      id: true,
      batchGroupId: true,
    },
  });

  const batchGroupIds = new Set<string>();
  let singleBookingCount = 0;

  for (const b of bookings) {
    if (b.batchGroupId) {
      batchGroupIds.add(b.batchGroupId);
    } else {
      singleBookingCount += 1;
    }
  }

  return batchGroupIds.size + singleBookingCount;
}
