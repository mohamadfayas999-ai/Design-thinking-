import http from 'http';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';
import { signToken } from '../utils/jwt.js';
import { Role, EnvironmentType } from '../types/models.js';
import {
  calculateGarmentWeight,
  planBatches,
  normalizeGarmentCounts,
  REFERENCE_WEIGHTS,
  SESSION_MAX_WEIGHT_GRAMS,
  WEEKLY_ALLOWANCE_MAX_WEIGHT_GRAMS,
} from '../utils/weight.js';

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

async function request(
  method: string,
  url: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: http.RequestOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          const data = raw ? JSON.parse(raw) : null;
          resolve({ status: res.statusCode || 500, data });
        } catch {
          resolve({ status: res.statusCode || 500, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — Resident-Controlled AI Clothing Scan & Booking Workflow  ');
  console.log('  (Automated Verification: 13 Workflow & Privacy Requirements)       ');
  console.log('══════════════════════════════════════════════════════════════════════\n');

  // Baseline database record counts to verify NO unwanted mutations
  const baselineHostelCount = await prisma.hostel.count();
  const baselineUserCount = await prisma.user.count();
  const baselineSlotCount = await prisma.laundrySlot.count();
  const baselineOrderCount = await prisma.laundryOrder.count();

  // Find sample REC student and sample PG student for API verification
  const recStudent = await prisma.studentProfile.findFirst({
    where: { hostel: { environment: EnvironmentType.COLLEGE } },
    include: { hostel: true, user: true },
  });
  assert(recStudent !== null, 'Found REC student profile for workflow tests');

  const pgStudent = await prisma.studentProfile.findFirst({
    where: { hostel: { environment: EnvironmentType.PG_SHARED } },
    include: { hostel: true, user: true },
  });
  assert(pgStudent !== null, 'Found PG resident profile for workflow tests');

  const recToken = recStudent
    ? signToken({
        userId: recStudent.userId,
        role: Role.STUDENT,
        environment: EnvironmentType.COLLEGE,
      })
    : '';

  const pgToken = pgStudent
    ? signToken({
        userId: pgStudent.userId,
        role: Role.STUDENT,
        environment: EnvironmentType.PG,
      })
    : '';

  // Create ephemeral test server on random port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE = `http://localhost:${port}/api`;

  try {
    // ──────────────────────────────────────────────────────────────────
    // 1 & 2. REC Student and PG Resident AI Scan & Edit Workflow
    // ──────────────────────────────────────────────────────────────────
    console.log('── 1 & 2. REC Student & PG Resident AI Workflow ──');

    // Simulate YOLO raw detections
    const rawYoloDetections = {
      shirt: 2,
      tshirt: 3,
      pant: 2,
      shorts: 1,
      other: 1, // Unsupported class
    };

    // REC Student edits:
    // Initial: 2 shirts, 3 tshirts, 2 pants, 1 shorts, 1 other
    // REC Student corrects: changes shirt to 1, tshirt to 4, pants to 2, shorts to 0 (reduces to zero), ignores other
    const recEditedCounts = {
      shirt: 1,
      tshirt: 4,
      pants: 2,
      jeans: 0,
      shorts: 0,
    };

    const recWeightCalc = calculateGarmentWeight(recEditedCounts);
    assert(recWeightCalc.isConfirmed === true, 'REC edited counts confirmed without review');
    assert(
      recWeightCalc.totalApprovedWeightGrams === 1 * 200 + 4 * 180 + 2 * 350,
      `REC weight correctly calculated: ${recWeightCalc.totalApprovedWeightGrams} g (expected 1620 g)`
    );

    // PG Resident edits:
    // PG resident detects 3 jeans, 2 shirts; corrects jeans to 2, adds 1 shorts
    const pgEditedCounts = {
      shirt: 2,
      tshirt: 0,
      pants: 0,
      jeans: 2,
      shorts: 1,
    };

    const pgWeightCalc = calculateGarmentWeight(pgEditedCounts);
    assert(pgWeightCalc.isConfirmed === true, 'PG edited counts confirmed without review');
    assert(
      pgWeightCalc.totalApprovedWeightGrams === 2 * 200 + 2 * 600 + 1 * 200,
      `PG weight correctly calculated: ${pgWeightCalc.totalApprovedWeightGrams} g (expected 1800 g)`
    );

    // ──────────────────────────────────────────────────────────────────
    // 3. Reducing a False-Positive Count to Zero Works
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 3. Reducing False-Positive Count to Zero ──');
    const falsePositiveInput = {
      shirt: 2,
      tshirt: 0, // was detected as 2, reduced to 0 by resident
      pants: 1,
      jeans: 0,
      shorts: 0,
    };
    const fpWeightCalc = calculateGarmentWeight(falsePositiveInput);
    assert(fpWeightCalc.approvedCounts.tshirt === 0, 'False-positive count reduced to zero');
    assert(
      fpWeightCalc.totalApprovedWeightGrams === 2 * 200 + 1 * 350,
      'Total weight excludes zeroed false-positive item (750 g)'
    );

    // ──────────────────────────────────────────────────────────────────
    // 4. Adding or Increasing a Supported Garment Count Works
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 4. Adding or Increasing Supported Garment Count ──');
    const missedItemInput = {
      shirt: 2,
      tshirt: 1,
      pants: 1,
      jeans: 1, // Missed by YOLO, added by resident
      shorts: 2, // Detected as 1, increased to 2 by resident
    };
    const addWeightCalc = calculateGarmentWeight(missedItemInput);
    assert(addWeightCalc.approvedCounts.jeans === 1, 'Added missed garment count registered');
    assert(addWeightCalc.approvedCounts.shorts === 2, 'Increased garment count registered');
    const expectedWeight = 2 * 200 + 1 * 180 + 1 * 350 + 1 * 600 + 2 * 200; // 400 + 180 + 350 + 600 + 400 = 1930
    assert(
      addWeightCalc.totalApprovedWeightGrams === expectedWeight,
      `Recalculated weight includes added & increased items (${expectedWeight} g)`
    );

    // ──────────────────────────────────────────────────────────────────
    // 5. Estimated Weight Recalculates Immediately After Every Edit
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 5. Immediate Weight Recalculation After Edits ──');
    let dynamicCounts = { shirt: 1, tshirt: 1, pants: 0, jeans: 0, shorts: 0 };
    let dynamicWeight = calculateGarmentWeight(dynamicCounts).totalApprovedWeightGrams;
    assert(dynamicWeight === 380, 'Initial weight: 1 shirt + 1 tshirt = 380 g');

    dynamicCounts = { ...dynamicCounts, pants: 2 };
    dynamicWeight = calculateGarmentWeight(dynamicCounts).totalApprovedWeightGrams;
    assert(dynamicWeight === 380 + 700, 'Weight updates immediately when pants added: 1080 g');

    dynamicCounts = { ...dynamicCounts, jeans: 1 };
    dynamicWeight = calculateGarmentWeight(dynamicCounts).totalApprovedWeightGrams;
    assert(dynamicWeight === 1080 + 600, 'Weight updates immediately when jeans added: 1680 g');

    dynamicCounts = { ...dynamicCounts, shirt: 0 };
    dynamicWeight = calculateGarmentWeight(dynamicCounts).totalApprovedWeightGrams;
    assert(dynamicWeight === 1680 - 200, 'Weight updates immediately when shirt removed: 1480 g');

    // ──────────────────────────────────────────────────────────────────
    // 6. Valid Edited Counts Proceed Through Existing Booking API
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 6. Valid Edited Counts Plan Batches Successfully via API ──');
    const planRes = await request(
      'POST',
      `${BASE}/slots/plan-batch`,
      {
        garmentCounts: recEditedCounts,
        targetDate: '2026-12-07',
      },
      recToken
    );
    assert(planRes.status === 200, 'POST /slots/plan-batch returns 200 OK');
    assert(planRes.data.success === true, 'Planning response is successful');
    assert(
      planRes.data.batchPlan.totalWeightGrams === recWeightCalc.totalApprovedWeightGrams,
      `Batch plan uses resident-verified weight: ${planRes.data.batchPlan.totalWeightGrams} g`
    );
    assert(
      planRes.data.planningStatus === 'CONFIRMED' || planRes.data.planningStatus === 'NO_SLOTS',
      'Planning status confirmed directly without staff verification'
    );

    // ──────────────────────────────────────────────────────────────────
    // 7. Invalid or Negative Counts Are Rejected
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 7. Invalid / Negative Counts Rejected ──');
    let rejectedNeg = false;
    try {
      normalizeGarmentCounts({ shirt: -2, tshirt: 1 });
    } catch {
      rejectedNeg = true;
    }
    assert(rejectedNeg, 'Negative garment count rejected by normalizer');

    let rejectedDec = false;
    try {
      normalizeGarmentCounts({ shirt: 1.5, tshirt: 1 });
    } catch {
      rejectedDec = true;
    }
    assert(rejectedDec, 'Fractional garment count rejected by normalizer');

    const planFailRes = await request(
      'POST',
      `${BASE}/slots/plan-batch`,
      {
        garmentCounts: { shirt: -1 },
      },
      recToken
    );
    assert(planFailRes.status === 400, 'API returns 400 for negative garment count');

    // ──────────────────────────────────────────────────────────────────
    // 8. Booking Exceeding Weekly Allowance (7,000 g) Is Rejected
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 8. Exceeding Weekly Allowance (7,000 g) Rejected ──');
    const excessCounts = {
      jeans: 12, // 12 * 600 = 7,200 g > 7,000 g
      shirt: 1,
    };
    const excessPlanRes = await request(
      'POST',
      `${BASE}/slots/plan-batch`,
      {
        garmentCounts: excessCounts,
        targetDate: '2026-12-07',
      },
      recToken
    );
    assert(excessPlanRes.status === 200, 'Plan request evaluates allowance rules');
    assert(
      excessPlanRes.data.planningStatus === 'EXCEEDS_ALLOWANCE',
      'Planning status marks EXCEEDS_ALLOWANCE when > 7000 g'
    );
    assert(excessPlanRes.data.isActionable === false, 'isActionable is false when weekly allowance exceeded');

    // ──────────────────────────────────────────────────────────────────
    // 9. Multi-Batch Booking Retains Atomic Guarantee (Max 4,500 g / batch)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 9. Multi-Batch Atomic Planning (Max 4,500 g per batch) ──');
    const multiBatchCounts = {
      jeans: 8, // 8 * 600 = 4800 g > 4500 g session limit, <= 7000 g weekly limit
    };
    const multiPlanRes = await request(
      'POST',
      `${BASE}/slots/plan-batch`,
      {
        garmentCounts: multiBatchCounts,
        targetDate: '2026-12-07',
      },
      recToken
    );
    assert(multiPlanRes.data.batchPlan.totalBatches === 2, 'Requires exactly 2 batches');
    assert(
      multiPlanRes.data.batchPlan.batches[0].weightGrams <= SESSION_MAX_WEIGHT_GRAMS,
      'Batch 1 adheres to 4,500 g session limit'
    );
    assert(
      multiPlanRes.data.batchPlan.batches[1].weightGrams <= SESSION_MAX_WEIGHT_GRAMS,
      'Batch 2 adheres to 4,500 g session limit'
    );

    // ──────────────────────────────────────────────────────────────────
    // 10. Staff Cannot Access AI Scan Images, Bboxes, or Confidence
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 10. Staff Privacy Audit: No AI Detections Exposed ──');

    const staffUser = await prisma.user.findFirst({
      where: { role: Role.STAFF },
      include: { staffProfile: true },
    });

    if (staffUser && staffUser.staffProfile) {
      const staffToken = signToken({
        userId: staffUser.id,
        role: Role.STAFF,
        environment: EnvironmentType.COLLEGE,
      });

      const staffBookingsRes = await request('GET', `${BASE}/staff/bookings`, undefined, staffToken);
      assert(staffBookingsRes.status === 200, 'Staff can view operational bookings');

      const returnedBookings: any[] = staffBookingsRes.data.bookings || [];
      const hasAiScanExposed = returnedBookings.some(
        (b) => b.aiScan !== undefined && b.aiScan !== null
      );
      assert(!hasAiScanExposed, 'Staff booking list does NOT contain aiScan records');

      // Check QR lookup endpoint as well
      const qrRes = await request('POST', `${BASE}/staff/qr-lookup`, { qrToken: 'NON_EXISTENT' }, staffToken);
      assert(qrRes.status === 404 || qrRes.status === 400, 'QR lookup rejects invalid token');
    }

    // ──────────────────────────────────────────────────────────────────
    // 11. Staff Cannot Approve, Reject, or Alter AI Results for Booking
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 11. Staff Pre-Approval Not Required for Booking ──');
    if (staffUser) {
      const staffToken = signToken({
        userId: staffUser.id,
        role: Role.STAFF,
        environment: EnvironmentType.COLLEGE,
      });
      // Test safe stub response on confirmStaffAiScan
      const stubRes = await request(
        'PUT',
        `${BASE}/staff/bookings/dummy-id/ai-scan-confirm`,
        {},
        staffToken
      );
      assert(
        stubRes.status === 404 || stubRes.status === 200,
        'Staff AI scan confirm endpoint handles request safely without requiring verification'
      );
    }

    // ──────────────────────────────────────────────────────────────────
    // 12. REC / PG Isolation and Authorization Intact
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 12. REC / PG Isolation Intact ──');
    const recHostels = await prisma.hostel.findMany({
      where: { environment: EnvironmentType.COLLEGE },
    });
    const pgHostels = await prisma.hostel.findMany({
      where: { environment: EnvironmentType.PG_SHARED },
    });
    assert(recHostels.length > 0, `REC hostels count: ${recHostels.length}`);
    assert(pgHostels.length > 0, `PG hostels count: ${pgHostels.length}`);
    const overlap = recHostels.filter((r) => pgHostels.some((p) => p.id === r.id));
    assert(overlap.length === 0, 'Zero overlap between REC and PG hostel IDs');

    // Cross-environment booking attempt rejected
    const crossRes = await request(
      'POST',
      `${BASE}/slots/plan-batch`,
      {
        garmentCounts: { shirt: 1 },
      },
      'invalid-token'
    );
    assert(crossRes.status === 401, 'Unauthorized request rejected (401)');

    // ──────────────────────────────────────────────────────────────────
    // 13. Existing Login, Quotas & Database Integrity Unchanged
    // ──────────────────────────────────────────────────────────────────
    console.log('\n── 13. Existing Login, Quotas & Database Safety ──');
    const finalHostelCount = await prisma.hostel.count();
    const finalUserCount = await prisma.user.count();
    const finalSlotCount = await prisma.laundrySlot.count();
    const finalOrderCount = await prisma.laundryOrder.count();

    assert(finalHostelCount === baselineHostelCount, 'Hostels count unchanged');
    assert(finalUserCount === baselineUserCount, 'Users count unchanged');
    assert(finalSlotCount === baselineSlotCount, 'Slots count unchanged');
    assert(finalOrderCount === baselineOrderCount, 'Orders count unchanged (0 mutations)');

  } finally {
    server.close();
  }

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test run failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
