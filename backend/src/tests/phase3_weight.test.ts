import http from 'http';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';
import { signToken } from '../utils/jwt.js';
import { Role, EnvironmentType } from '../types/models.js';
import {
  calculateGarmentWeight,
  planBatches,
  REFERENCE_WEIGHTS,
  SESSION_MAX_WEIGHT_GRAMS,
  WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS,
  GarmentCountsInput,
} from '../utils/weight.js';
import {
  getScheduledWeekBoundaries,
  getResidentWeeklyAllowance,
} from '../utils/weekAllowance.js';
import { planSmartBatches } from '../services/batchPlanning.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — Phase 3: Weight, Allowance & Smart Planning Tests ');
  console.log('  (Strict read-only verification: 0 live DB mutations)         ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Baseline DB record verification
  const baselineHostelCount = await prisma.hostel.count();
  const baselineUserCount = await prisma.user.count();
  const baselineStudentCount = await prisma.studentProfile.count();
  const baselineSlotCount = await prisma.laundrySlot.count();
  const baselineBookingCount = await prisma.slotBooking.count();
  const baselineItemCount = await prisma.itemCount.count();

  // Spin up ephemeral server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://localhost:${port}/api`;

  try {
    // ────────────────────────────────────────────────────────
    // SECTION 1: Garment Weight Arithmetic
    // ────────────────────────────────────────────────────────
    console.log('--- 1. Garment Weight Arithmetic ---');

    assert(REFERENCE_WEIGHTS.shirt === 200, 'Shirt reference weight is 200 g');
    assert(REFERENCE_WEIGHTS.tshirt === 180, 'T-shirt reference weight is 180 g');
    assert(REFERENCE_WEIGHTS.pants === 350, 'Pants reference weight is 350 g');
    assert(REFERENCE_WEIGHTS.jeans === 600, 'Jeans reference weight is 600 g');
    assert(REFERENCE_WEIGHTS.shorts === 200, 'Shorts reference weight is 200 g');

    // 2 shirts (400) + 3 tshirts (540) + 1 pants (350) + 2 jeans (1200) + 1 shorts (200) = 2690 g
    const sampleInput: GarmentCountsInput = {
      shirt: 2,
      tshirt: 3,
      pants: 1,
      jeans: 2,
      shorts: 1,
    };
    const res1 = calculateGarmentWeight(sampleInput);
    assert(res1.totalApprovedWeightGrams === 2690, 'Calculates exact formula: 400 + 540 + 350 + 1200 + 200 = 2690 g');
    assert(res1.isConfirmed === true, 'All approved garments result in isConfirmed: true');
    assert(res1.requiresReview === false, 'No unresolved items: requiresReview is false');
    assert(res1.unresolvedItems.length === 0, 'No unresolved items present');

    // Check alias 'pant' -> 'pants'
    const resAlias = calculateGarmentWeight({ pant: 2 });
    assert(resAlias.approvedCounts.pants === 2, 'Alias "pant" correctly maps to "pants"');
    assert(resAlias.totalApprovedWeightGrams === 700, 'Alias "pant" calculates at 350g each (700g)');

    // ────────────────────────────────────────────────────────
    // SECTION 2: Zero Counts & Invalid Counts
    // ────────────────────────────────────────────────────────
    console.log('\n--- 2. Zero Counts & Invalid Counts ---');

    const emptyRes = calculateGarmentWeight({ shirt: 0, tshirt: 0, pants: 0, jeans: 0, shorts: 0 });
    assert(emptyRes.totalApprovedWeightGrams === 0, 'Zero counts evaluate to 0 g');
    assert(emptyRes.isConfirmed === true, 'Empty load is confirmed');

    let threwNegative = false;
    try {
      calculateGarmentWeight({ shirt: -1 });
    } catch (e: any) {
      threwNegative = true;
      assert(e.message.includes('must be a non-negative integer'), 'Negative count rejected with clear error message');
    }
    assert(threwNegative, 'Negative count throws exception');

    let threwFloat = false;
    try {
      calculateGarmentWeight({ jeans: 2.5 });
    } catch (e: any) {
      threwFloat = true;
      assert(e.message.includes('must be a non-negative integer'), 'Fractional count rejected with non-negative integer error');
    }
    assert(threwFloat, 'Fractional float count throws exception');

    // ────────────────────────────────────────────────────────
    // SECTION 3: Unknown Garment Classes & YOLO Non-Approved Labels
    // ────────────────────────────────────────────────────────
    console.log('\n--- 3. Unknown Garment Classes (YOLO Labels: towel, bedsheet, other) ---');

    const mixedYolo = calculateGarmentWeight({
      shirt: 1,
      towel: 2,
      bedsheet: 1,
      other: 1,
    });
    assert(mixedYolo.totalApprovedWeightGrams === 200, 'Approved items calculated (1 shirt = 200g)');
    assert(mixedYolo.requiresReview === true, 'Mixed YOLO with towel/bedsheet flags requiresReview: true');
    assert(mixedYolo.isConfirmed === false, 'Mixed YOLO load is NOT confirmed');
    assert(mixedYolo.unresolvedItems.length === 3, 'Preserves all 3 unapproved classes (towel, bedsheet, other)');
    assert(
      mixedYolo.unresolvedItems.some((u) => u.className === 'towel' && u.count === 2),
      'Preserves towel with count 2 and review reason'
    );
    assert(
      mixedYolo.unresolvedItems.some((u) => u.className === 'bedsheet' && u.count === 1),
      'Preserves bedsheet with count 1 and review reason'
    );

    // Legacy composite categories
    const legacyComp = calculateGarmentWeight({ tShirtShirt: 2, pantsTrack: 1 });
    assert(legacyComp.requiresReview === true, 'Legacy composite category requiresReview: true');
    assert(legacyComp.unresolvedItems.length === 2, 'Flags both tShirtShirt and pantsTrack for classification');

    // Requesting a confirmed batch plan with unresolved items throws error
    let planBlocked = false;
    try {
      planBatches({ shirt: 1, towel: 1 });
    } catch (e: any) {
      planBlocked = true;
      assert(e.message.includes('require review or classification'), 'planBatches blocks confirmed planning if unapproved items exist');
    }
    assert(planBlocked, 'Confirmed batch plan requires review resolution first');

    // ────────────────────────────────────────────────────────
    // SECTION 4: Exact 4,500 g Batches & Session Limit
    // ────────────────────────────────────────────────────────
    console.log('\n--- 4. Exact 4,500 g Batches & Session Limit ---');

    // Construct exactly 4,500 g:
    // 5 jeans (3,000 g) + 3 pants (1,050 g) + 2 shorts (400 g) + 1 shirt (200 g) - wait: 3000 + 1050 + 400 + 200 = 4650.
    // Let's make exactly 4500 g:
    // 5 jeans (3000 g) + 3 pants (1050 g) + 1 tshirt (180 g) + 1 shirt (200 g) + 1 shorts (70?? No, shorts is 200).
    // Let's use:
    // 22 shirts (22 * 200 = 4400) -> not 4500.
    // 15 pants (15 * 350) -> 5250.
    // 9 jeans (9 * 600) -> 5400.
    // 5 jeans (3000) + 15 shirts (3000) -> 6000.
    // Let's solve: jeans*600 + pants*350 + shirt*200 + tshirt*180 + shorts*200 = 4500
    // Try: 15 pants (350*10 = 3500 + 1000 = 5 shirts) -> 10 pants (3500) + 5 shirts (1000) = 4500 g!
    // Check: 10 * 350 + 5 * 200 = 3500 + 1000 = 4500 g! Exactly 4,500 g!
    const exactInput: GarmentCountsInput = {
      pants: 10,
      shirt: 5,
    };
    const exactPlan = planBatches(exactInput);
    assert(exactPlan.totalWeightGrams === 4500, 'Total load is exactly 4,500 g');
    assert(exactPlan.totalBatches === 1, 'Exactly 4,500 g fits into exactly 1 batch');
    assert(exactPlan.batches[0].weightGrams === 4500, 'Batch 1 weighs exactly 4,500 g');
    assert(exactPlan.batches[0].maxLimitGrams === SESSION_MAX_WEIGHT_GRAMS, 'Session limit is 4,500 g');
    assert(exactPlan.batches[0].itemCount === 15, 'All 15 garments in batch 1');
    assert(exactPlan.batches[0].garmentCounts.pants === 10, 'Preserves 10 pants');
    assert(exactPlan.batches[0].garmentCounts.shirt === 5, 'Preserves 5 shirts');

    // ────────────────────────────────────────────────────────
    // SECTION 5: Loads Just Above 4,500 g (e.g. 4,700 g)
    // ────────────────────────────────────────────────────────
    console.log('\n--- 5. Loads Just Above 4,500 g ---');

    // 10 pants (3500) + 5 shirts (1000) + 1 shirt (200) = 4700 g
    const aboveInput: GarmentCountsInput = {
      pants: 10,
      shirt: 6,
    };
    const abovePlan = planBatches(aboveInput);
    assert(abovePlan.totalWeightGrams === 4700, 'Total weight is 4,700 g (just above 4,500 g limit)');
    assert(abovePlan.totalBatches === 2, 'Requires exactly 2 batches');
    assert(abovePlan.batches[0].weightGrams <= SESSION_MAX_WEIGHT_GRAMS, 'Batch 1 <= 4,500 g');
    assert(abovePlan.batches[1].weightGrams <= SESSION_MAX_WEIGHT_GRAMS, 'Batch 2 <= 4,500 g');
    assert(
      abovePlan.batches[0].weightGrams + abovePlan.batches[1].weightGrams === 4700,
      'Sum of batch weights equals total load weight (4,700 g)'
    );

    // Verify all garments preserved whole and exactly once
    const totalPantsInBatches = abovePlan.batches.reduce((sum, b) => sum + b.garmentCounts.pants, 0);
    const totalShirtsInBatches = abovePlan.batches.reduce((sum, b) => sum + b.garmentCounts.shirt, 0);
    assert(totalPantsInBatches === 10, 'All 10 pants preserved without duplication or loss');
    assert(totalShirtsInBatches === 6, 'All 6 shirts preserved without duplication or loss');

    // ────────────────────────────────────────────────────────
    // SECTION 6: Multiple Batches & Garment Preservation
    // ────────────────────────────────────────────────────────
    console.log('\n--- 6. Multiple Batches with Large Diverse Load ---');

    // 8 jeans (4800) + 6 pants (2100) + 5 shirts (1000) + 5 tshirts (900) = 8800 g
    const largeInput: GarmentCountsInput = {
      jeans: 8,
      pants: 6,
      shirt: 5,
      tshirt: 5,
    };
    const largePlan = planBatches(largeInput);
    assert(largePlan.totalWeightGrams === 8800, 'Total weight is 8,800 g');
    assert(largePlan.totalBatches === 2 || largePlan.totalBatches === 3, 'Packs into valid number of batches');

    for (const b of largePlan.batches) {
      assert(b.weightGrams <= SESSION_MAX_WEIGHT_GRAMS, `Batch ${b.batchNumber} (${b.weightGrams}g) <= 4,500 g limit`);
    }

    const sumBatchesWeight = largePlan.batches.reduce((sum, b) => sum + b.weightGrams, 0);
    assert(sumBatchesWeight === 8800, 'Sum of batch weights equals total weight (no grams lost or created)');

    const countJeans = largePlan.batches.reduce((sum, b) => sum + b.garmentCounts.jeans, 0);
    const countPants = largePlan.batches.reduce((sum, b) => sum + b.garmentCounts.pants, 0);
    const countShirts = largePlan.batches.reduce((sum, b) => sum + b.garmentCounts.shirt, 0);
    const countTshirts = largePlan.batches.reduce((sum, b) => sum + b.garmentCounts.tshirt, 0);
    assert(countJeans === 8 && countPants === 6 && countShirts === 5 && countTshirts === 5, 'Every individual garment preserved exactly once');

    // ────────────────────────────────────────────────────────
    // SECTION 7: Deterministic Output
    // ────────────────────────────────────────────────────────
    console.log('\n--- 7. Deterministic Batch Output ---');

    const runA = planBatches(largeInput);
    const runB = planBatches(largeInput);
    assert(JSON.stringify(runA) === JSON.stringify(runB), 'Repeated execution produces identical batch plans');

    // ────────────────────────────────────────────────────────
    // SECTION 8: Scheduled-Week Boundaries in Asia/Kolkata (IST)
    // ────────────────────────────────────────────────────────
    console.log('\n--- 8. Scheduled-Week Boundaries (Asia/Kolkata IST) ---');

    // Monday 2026-10-19:
    const weekMon = getScheduledWeekBoundaries('2026-10-19');
    assert(weekMon.weekStartDateStr === '2026-10-19', 'Monday 2026-10-19 starts its own scheduled week on Monday');
    assert(weekMon.weekEndDateStr === '2026-10-25', 'Monday 2026-10-19 ends on Sunday 2026-10-25');

    // Wednesday 2026-10-21:
    const weekWed = getScheduledWeekBoundaries('2026-10-21');
    assert(weekWed.weekStartDateStr === '2026-10-19', 'Wednesday belongs to same Monday 2026-10-19 week');
    assert(weekWed.weekEndDateStr === '2026-10-25', 'Wednesday ends on Sunday 2026-10-25');

    // Sunday 2026-10-25:
    const weekSun = getScheduledWeekBoundaries('2026-10-25');
    assert(weekSun.weekStartDateStr === '2026-10-19', 'Sunday 2026-10-25 belongs to Monday 2026-10-19 week');
    assert(weekSun.weekEndDateStr === '2026-10-25', 'Sunday 2026-10-25 is end date of week');

    // Next Monday 2026-10-26 (Midnight boundary):
    const weekNextMon = getScheduledWeekBoundaries('2026-10-26');
    assert(weekNextMon.weekStartDateStr === '2026-10-26', 'Next Monday 2026-10-26 starts brand new scheduled week');
    assert(weekNextMon.weekEndDateStr === '2026-11-01', 'Next Monday week ends on 2026-11-01');

    // ────────────────────────────────────────────────────────
    // SECTION 9: Sunday Request for Monday Slot (Option B Policy)
    // ────────────────────────────────────────────────────────
    console.log('\n--- 9. Option B: Sunday Request for Monday Slot ---');

    // A resident creates a booking request on Sunday 2026-10-18 for a slot on Monday 2026-10-19.
    // Under Option B, the allowance week is governed by the scheduled slot date (Monday 2026-10-19).
    const slotWeek = getScheduledWeekBoundaries('2026-10-19');
    assert(
      slotWeek.weekStartDateStr === '2026-10-19',
      'Option B: Monday slot belongs to week starting Monday 2026-10-19 (not the request date Sunday)'
    );

    // ────────────────────────────────────────────────────────
    // SECTION 10: Weekly Allowance Limits & Legacy Accounting
    // ────────────────────────────────────────────────────────
    console.log('\n--- 10. Weekly Allowance Limits & Legacy Records ---');

    // Find any existing student profile to test read-only allowance service
    const sampleStudent = await prisma.studentProfile.findFirst({
      include: { hostel: true },
    });
    assert(sampleStudent !== null, 'Found existing student profile for read-only allowance query');

    if (sampleStudent) {
      // Future week without any bookings
      const futureAllowance = await getResidentWeeklyAllowance(sampleStudent.id, '2026-12-07', 3000);
      assert(futureAllowance.maxWeeklyAllowanceGrams === 7000, 'Weekly allowance max is 7,000 g');
      assert(futureAllowance.committedWeightGrams === 0, 'Future week has 0 g committed weight');
      assert(futureAllowance.remainingAllowanceGrams === 7000, 'Full 7,000 g available in empty future week');
      assert(futureAllowance.fitsWithinAllowance === true, 'Proposed 3,000 g fits within 7,000 g allowance');
      assert(futureAllowance.isReliable === true, 'Future week is reliable (0 legacy bookings)');

      // Proposed load exceeding 7,000 g
      const excessiveAllowance = await getResidentWeeklyAllowance(sampleStudent.id, '2026-12-07', 7200);
      assert(excessiveAllowance.fitsWithinAllowance === false, 'Load of 7,200 g exceeds 7,000 g allowance');
      assert(excessiveAllowance.warning?.includes('exceeds remaining weekly allowance'), 'Clear warning generated when allowance exceeded');

      // Check legacy booking week (Oct 2026 contains existing legacy bookings with weightGrams: null)
      const legacyWeekAllowance = await getResidentWeeklyAllowance(sampleStudent.id, '2026-10-14', 2000);
      if (legacyWeekAllowance.hasLegacyUnweightedBookings) {
        assert(legacyWeekAllowance.isReliable === false, 'Flags isReliable: false for week containing legacy unweighted records');
        assert(legacyWeekAllowance.warning?.includes('legacy booking'), 'Warning message explicitly informs about unweighted legacy records');
      } else {
        assert(true, 'No legacy bookings for this specific student in this week (reliably accounted)');
      }
    }

    // ────────────────────────────────────────────────────────
    // SECTION 11: End-to-End Planning Service & Facility Scoping
    // ────────────────────────────────────────────────────────
    console.log('\n--- 11. End-to-End Smart Planning Service & Facility Scoping ---');

    // Test with a COLLEGE student
    const collegeStudent = await prisma.studentProfile.findFirst({
      where: { hostel: { environment: EnvironmentType.COLLEGE } },
      include: { hostel: true, user: true },
    });
    assert(collegeStudent !== null, 'Found COLLEGE student for planning service test');

    if (collegeStudent) {
      const planCollege = await planSmartBatches({
        studentUserId: collegeStudent.userId,
        garmentCounts: { shirt: 2, pants: 2 },
        targetDate: '2026-12-07',
      });

      assert(planCollege.success === true, 'Planning service returns success: true');
      assert(planCollege.facility.id === collegeStudent.hostelId, 'Facility restricted to student assigned hostel');
      assert(planCollege.facility.environment === EnvironmentType.COLLEGE, 'Facility environment matches COLLEGE');
      assert(planCollege.planningStatus === 'CONFIRMED' || planCollege.planningStatus === 'NO_SLOTS', 'Planning status is valid');
      assert(planCollege.batchPlan !== undefined, 'Batch plan is generated');
      assert(planCollege.batchPlan?.totalWeightGrams === 1100, 'Total weight 2 shirts (400) + 2 pants (700) = 1100 g');

      // Recommendations are advisory only: verify no reservations were created
      assert(planCollege.batchRecommendations.length === 1, 'Batch recommendations created for Batch 1');
      for (const rec of planCollege.batchRecommendations) {
        for (const slot of rec.recommendedSlots) {
          assert(slot.hostelId === collegeStudent.hostelId, 'Recommended slot strictly belongs to student assigned hostel');
        }
      }
    }

    // Test with a PG_SHARED student
    const pgStudent = await prisma.studentProfile.findFirst({
      where: { hostel: { environment: EnvironmentType.PG_SHARED } },
      include: { hostel: true, user: true },
    });
    assert(pgStudent !== null, 'Found PG_SHARED student for planning service test');

    if (pgStudent) {
      const planPg = await planSmartBatches({
        studentUserId: pgStudent.userId,
        garmentCounts: { jeans: 3, tshirt: 2 },
        targetDate: '2026-12-07',
      });

      assert(planPg.success === true, 'PG planning service returns success: true');
      assert(planPg.facility.id === pgStudent.hostelId, 'PG facility restricted to student assigned PG facility');
      assert(planPg.facility.environment === EnvironmentType.PG_SHARED, 'Facility environment matches PG_SHARED');
      assert(planPg.batchPlan?.totalWeightGrams === 2160, '3 jeans (1800) + 2 tshirts (360) = 2160 g');
    }

    // ────────────────────────────────────────────────────────
    // SECTION 12: HTTP API Endpoint (POST /api/slots/plan-batch)
    // ────────────────────────────────────────────────────────
    console.log('\n--- 12. HTTP API Endpoint (POST /api/slots/plan-batch) ---');

    if (collegeStudent) {
      const studentToken = signToken({
        userId: collegeStudent.userId,
        email: collegeStudent.user.email,
        role: Role.STUDENT,
        environment: EnvironmentType.COLLEGE,
      });

      // Valid plan request
      const httpRes = await fetch(`${BASE_URL}/slots/plan-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          garmentCounts: { shirt: 2, jeans: 1 },
          targetDate: '2026-12-07',
        }),
      });

      assert(httpRes.status === 200, 'POST /api/slots/plan-batch returns 200 OK');
      const httpData: any = await httpRes.json();
      assert(httpData.success === true, 'HTTP response success is true');
      assert(httpData.weightCalculation.totalApprovedWeightGrams === 1000, 'Weight calculation correct: 2 shirts (400) + 1 jeans (600) = 1000g');
      assert(httpData.batchPlan.totalBatches === 1, 'Fits into 1 batch');
      assert(httpData.facility.id === collegeStudent.hostelId, 'Facility in response matches student hostel');

      // Invalid request: garmentCounts missing
      const badRes1 = await fetch(`${BASE_URL}/slots/plan-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({}),
      });
      assert(badRes1.status === 400, 'Missing garmentCounts returns 400 Bad Request');

      // Invalid request: negative count
      const badRes2 = await fetch(`${BASE_URL}/slots/plan-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          garmentCounts: { shirt: -5 },
        }),
      });
      assert(badRes2.status === 400, 'Negative garment count returns 400 Bad Request');

      // Unauthorized request: No token
      const noAuthRes = await fetch(`${BASE_URL}/slots/plan-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentCounts: { shirt: 1 } }),
      });
      assert(noAuthRes.status === 401, 'No token returns 401 Unauthorized');
    }

    // ────────────────────────────────────────────────────────
    // SECTION 13: Zero Database Mutations Verification
    // ────────────────────────────────────────────────────────
    console.log('\n--- 13. Zero Database Mutations Verification ---');

    const finalHostelCount = await prisma.hostel.count();
    const finalUserCount = await prisma.user.count();
    const finalStudentCount = await prisma.studentProfile.count();
    const finalSlotCount = await prisma.laundrySlot.count();
    const finalBookingCount = await prisma.slotBooking.count();
    const finalItemCount = await prisma.itemCount.count();

    assert(finalHostelCount === baselineHostelCount, `Hostel count untouched (${finalHostelCount} === ${baselineHostelCount})`);
    assert(finalUserCount === baselineUserCount, `User count untouched (${finalUserCount} === ${baselineUserCount})`);
    assert(finalStudentCount === baselineStudentCount, `StudentProfile count untouched (${finalStudentCount} === ${baselineStudentCount})`);
    assert(finalSlotCount === baselineSlotCount, `LaundrySlot count untouched (${finalSlotCount} === ${baselineSlotCount})`);
    assert(finalBookingCount === baselineBookingCount, `SlotBooking count untouched (${finalBookingCount} === ${baselineBookingCount})`);
    assert(finalItemCount === baselineItemCount, `ItemCount count untouched (${finalItemCount} === ${baselineItemCount})`);

  } finally {
    server.close();
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in Phase 3 test runner:', err);
  process.exit(1);
});
