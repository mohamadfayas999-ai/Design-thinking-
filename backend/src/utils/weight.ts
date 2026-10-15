/**
 * WASHWISE Garment Weight Calculation and Batch Planning Utility
 * 
 * Approved reference weights (integer grams):
 * - Shirt:   200 g
 * - T-shirt: 180 g
 * - Pants:   350 g
 * - Jeans:   600 g
 * - Shorts:  200 g
 * 
 * Session limit: 4,500 g per batch
 * Weekly resident allowance: 7,000 g per scheduled week
 */

export const REFERENCE_WEIGHTS = {
  shirt: 200,
  tshirt: 180,
  pants: 350,
  jeans: 600,
  shorts: 200,
} as const;

export type ApprovedGarmentType = keyof typeof REFERENCE_WEIGHTS;

export const SESSION_MAX_WEIGHT_GRAMS = 4500;
export const WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS = 7000;

export interface GarmentCountsInput {
  shirt?: number;
  tshirt?: number;
  pants?: number;
  pant?: number; // alias for pants
  jeans?: number;
  shorts?: number;
  // Aliases from legacy / YOLO labels
  tShirtShirt?: number;
  pantsTrack?: number;
  [key: string]: number | undefined;
}

export interface WeightCalculationResult {
  totalApprovedWeightGrams: number;
  isConfirmed: boolean;
  requiresReview: boolean;
  approvedCounts: Record<ApprovedGarmentType, number>;
  breakdown: Record<
    ApprovedGarmentType,
    { count: number; unitWeightGrams: number; subtotalGrams: number }
  >;
  unresolvedItems: Array<{
    className: string;
    count: number;
    reason: string;
  }>;
}

export interface BatchPlanItem {
  batchNumber: number;
  totalBatches: number;
  weightGrams: number;
  maxLimitGrams: number;
  itemCount: number;
  garmentCounts: Record<ApprovedGarmentType, number>;
}

export interface BatchPlanResult {
  totalWeightGrams: number;
  totalBatches: number;
  batches: BatchPlanItem[];
  isConfirmed: boolean;
  unbatchableGarments?: Array<{ className: string; weightGrams: number }>;
}

/**
 * Normalizes user/AI garment input into approved garment keys and flags unapproved classes.
 */
export function normalizeGarmentCounts(input: GarmentCountsInput): {
  approvedCounts: Record<ApprovedGarmentType, number>;
  unresolvedItems: Array<{ className: string; count: number; reason: string }>;
} {
  const approvedCounts: Record<ApprovedGarmentType, number> = {
    shirt: 0,
    tshirt: 0,
    pants: 0,
    jeans: 0,
    shorts: 0,
  };

  const unresolvedItems: Array<{ className: string; count: number; reason: string }> = [];

  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (rawVal === undefined || rawVal === null) continue;

    const count = Number(rawVal);
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Garment count for '${rawKey}' must be a non-negative integer (received ${rawVal}).`);
    }

    if (count === 0) continue;

    const key = rawKey.trim().toLowerCase();

    // Map approved categories and known aliases
    if (key === 'shirt') {
      approvedCounts.shirt += count;
    } else if (key === 'tshirt' || key === 't-shirt' || key === 't_shirt') {
      approvedCounts.tshirt += count;
    } else if (key === 'pants' || key === 'pant') {
      approvedCounts.pants += count;
    } else if (key === 'jeans') {
      approvedCounts.jeans += count;
    } else if (key === 'shorts' || key === 'short') {
      approvedCounts.shorts += count;
    } else if (key === 'tshirtshirt') {
      // Legacy combined category: cannot be confirmed without specific breakdown
      unresolvedItems.push({
        className: rawKey,
        count,
        reason: 'Legacy composite category "T-Shirt/Shirt" requires breakdown into individual shirts (200g) or t-shirts (180g).',
      });
    } else if (key === 'pantstrack') {
      // Legacy combined category: cannot be confirmed without specific breakdown
      unresolvedItems.push({
        className: rawKey,
        count,
        reason: 'Legacy composite category "Pants/Track" requires breakdown into pants (350g), jeans (600g), or shorts (200g).',
      });
    } else {
      // Unapproved YOLO classes: towel, bedsheet, other, etc.
      unresolvedItems.push({
        className: rawKey,
        count,
        reason: `Item class "${rawKey}" has no approved reference weight and requires classification/review.`,
      });
    }
  }

  return { approvedCounts, unresolvedItems };
}

/**
 * Calculates confirmed garment weight in integer grams.
 * If unresolved items are present, flags requiresReview = true and isConfirmed = false.
 */
export function calculateGarmentWeight(input: GarmentCountsInput): WeightCalculationResult {
  const { approvedCounts, unresolvedItems } = normalizeGarmentCounts(input);

  const breakdown: Record<
    ApprovedGarmentType,
    { count: number; unitWeightGrams: number; subtotalGrams: number }
  > = {
    shirt: {
      count: approvedCounts.shirt,
      unitWeightGrams: REFERENCE_WEIGHTS.shirt,
      subtotalGrams: approvedCounts.shirt * REFERENCE_WEIGHTS.shirt,
    },
    tshirt: {
      count: approvedCounts.tshirt,
      unitWeightGrams: REFERENCE_WEIGHTS.tshirt,
      subtotalGrams: approvedCounts.tshirt * REFERENCE_WEIGHTS.tshirt,
    },
    pants: {
      count: approvedCounts.pants,
      unitWeightGrams: REFERENCE_WEIGHTS.pants,
      subtotalGrams: approvedCounts.pants * REFERENCE_WEIGHTS.pants,
    },
    jeans: {
      count: approvedCounts.jeans,
      unitWeightGrams: REFERENCE_WEIGHTS.jeans,
      subtotalGrams: approvedCounts.jeans * REFERENCE_WEIGHTS.jeans,
    },
    shorts: {
      count: approvedCounts.shorts,
      unitWeightGrams: REFERENCE_WEIGHTS.shorts,
      subtotalGrams: approvedCounts.shorts * REFERENCE_WEIGHTS.shorts,
    },
  };

  const totalApprovedWeightGrams =
    breakdown.shirt.subtotalGrams +
    breakdown.tshirt.subtotalGrams +
    breakdown.pants.subtotalGrams +
    breakdown.jeans.subtotalGrams +
    breakdown.shorts.subtotalGrams;

  const requiresReview = unresolvedItems.length > 0;
  const isConfirmed = !requiresReview;

  return {
    totalApprovedWeightGrams,
    isConfirmed,
    requiresReview,
    approvedCounts,
    breakdown,
    unresolvedItems,
  };
}

/**
 * Deterministically packs garments into batches of at most 4,500 grams.
 * Uses First-Fit Decreasing (FFD) with deterministic tie-breaking.
 * Preserves every input garment whole and exactly once.
 */
export function planBatches(input: GarmentCountsInput): BatchPlanResult {
  const weightCalc = calculateGarmentWeight(input);

  if (!weightCalc.isConfirmed) {
    throw new Error(
      `Cannot create confirmed batch plan: ${weightCalc.unresolvedItems.length} garment category(s) require review or classification first.`
    );
  }

  const { approvedCounts, totalApprovedWeightGrams } = weightCalc;

  // Empty load
  if (totalApprovedWeightGrams === 0) {
    return {
      totalWeightGrams: 0,
      totalBatches: 0,
      batches: [],
      isConfirmed: true,
    };
  }

  // 1. Expand each individual garment
  interface GarmentItem {
    type: ApprovedGarmentType;
    weight: number;
  }

  const items: GarmentItem[] = [];
  for (const [type, count] of Object.entries(approvedCounts)) {
    const garmentType = type as ApprovedGarmentType;
    const unitWeight = REFERENCE_WEIGHTS[garmentType];

    for (let i = 0; i < count; i++) {
      items.push({ type: garmentType, weight: unitWeight });
    }
  }

  // Check for any individual unbatchable garment (> 4500g)
  const unbatchable = items.filter((item) => item.weight > SESSION_MAX_WEIGHT_GRAMS);
  if (unbatchable.length > 0) {
    return {
      totalWeightGrams: totalApprovedWeightGrams,
      totalBatches: 0,
      batches: [],
      isConfirmed: false,
      unbatchableGarments: unbatchable.map((u) => ({
        className: u.type,
        weightGrams: u.weight,
      })),
    };
  }

  // 2. Sort garments by weight descending, then by type alphabetically for deterministic ordering
  items.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.type.localeCompare(b.type);
  });

  // 3. First-Fit Decreasing packing
  interface BatchBucket {
    weight: number;
    garments: Record<ApprovedGarmentType, number>;
    count: number;
  }

  const buckets: BatchBucket[] = [];

  for (const item of items) {
    let placed = false;

    for (const bucket of buckets) {
      if (bucket.weight + item.weight <= SESSION_MAX_WEIGHT_GRAMS) {
        bucket.weight += item.weight;
        bucket.garments[item.type] = (bucket.garments[item.type] || 0) + 1;
        bucket.count++;
        placed = true;
        break;
      }
    }

    if (!placed) {
      const newBucket: BatchBucket = {
        weight: item.weight,
        garments: {
          shirt: 0,
          tshirt: 0,
          pants: 0,
          jeans: 0,
          shorts: 0,
        },
        count: 1,
      };
      newBucket.garments[item.type] = 1;
      buckets.push(newBucket);
    }
  }

  const totalBatches = buckets.length;
  const batches: BatchPlanItem[] = buckets.map((bucket, index) => ({
    batchNumber: index + 1,
    totalBatches,
    weightGrams: bucket.weight,
    maxLimitGrams: SESSION_MAX_WEIGHT_GRAMS,
    itemCount: bucket.count,
    garmentCounts: bucket.garments,
  }));

  return {
    totalWeightGrams: totalApprovedWeightGrams,
    totalBatches,
    batches,
    isConfirmed: true,
  };
}
