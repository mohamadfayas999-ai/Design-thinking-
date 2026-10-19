import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import assert from 'assert';
import http from 'http';
import fetch from 'node-fetch';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';
import { errorHandler } from '../middlewares/error.middleware.js';

async function runAdminSummaryOptimizationSuite() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — Admin Summary Optimization & Safe Error Handling Tests   ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://localhost:${port}/api`;

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Authenticate as REC Admin and PG Admin
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[Step 1] Authenticating REC Admin...');
    const recLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rajalakshmi.edu.in', password: process.env.TEST_REC_ADMIN_PASSWORD ?? '', role: 'ADMIN' }),
    });
    const recLoginJson = (await recLoginRes.json()) as any;
    const recToken = recLoginJson.token;
    assert(recToken, `REC Admin token must be obtained, got: ${JSON.stringify(recLoginJson)}`);
    console.log('  ✅ REC Admin authenticated successfully.');

    console.log('\n[Step 2] Authenticating PG Admin...');
    const pgLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@pgsharedliving.com', password: process.env.TEST_PG_ADMIN_PASSWORD ?? '', role: 'ADMIN' }),
    });
    const pgLoginJson = (await pgLoginRes.json()) as any;
    const pgToken = pgLoginJson.token;
    assert(pgToken, `PG Admin token must be obtained, got: ${JSON.stringify(pgLoginJson)}`);
    console.log('  ✅ PG Admin authenticated successfully.');

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Test REC Admin Summary Response Structure and Scoping
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 3] Verifying REC Admin GET /api/admin/summary...');
    const recSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${recToken}` },
    });
    assert.strictEqual(recSummaryRes.status, 200, 'REC summary must return 200');
    const recSummary = (await recSummaryRes.json()) as any;
    assert.strictEqual(recSummary.success, true);
    assert(recSummary.summary, 'Summary object must exist');
    assert(recSummary.hostels, 'Hostels array must exist');
    assert(recSummary.insights, 'Insights object must exist');

    // Verify all 16 summary fields
    const s = recSummary.summary;
    const expectedSummaryFields = [
      'totalStudents',
      'totalStaff',
      'todayBookings',
      'totalBookings',
      'activeBookings',
      'cancelledBookings',
      'upcomingBookings',
      'inProgressOrders',
      'completedOrders',
      'verifiedOrders',
      'underReviewComplaints',
      'resolvedComplaints',
      'totalStorageLocations',
      'occupiedStorageLocations',
      'availableStorageLocations',
      'storageUtilizationPercent',
    ];
    for (const field of expectedSummaryFields) {
      assert(field in s, `Summary must contain ${field}`);
      assert(typeof s[field] === 'number', `${field} must be a number`);
    }

    // Verify REC hostels isolation
    const recHostelCodes = recSummary.hostels.map((h: any) => h.code);
    console.log('  REC Admin Hostels returned:', recHostelCodes);
    assert(recHostelCodes.length === 3, 'REC Admin must see exactly 3 hostels');
    assert(recHostelCodes.includes('GIRLS'));
    assert(recHostelCodes.includes('HABITAT'));
    assert(recHostelCodes.includes('THANDALAM'));
    assert(!recHostelCodes.includes('OAK_HOUSE'), 'REC Admin must not see PG Oak House');
    assert(!recHostelCodes.includes('MAPLE_VILLA'), 'REC Admin must not see PG Maple Villa');
    console.log('  ✅ REC Admin summary fields and environment isolation verified.');

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Test PG Admin Summary Response Structure and Scoping
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 4] Verifying PG Admin GET /api/admin/summary...');
    const pgSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${pgToken}` },
    });
    assert.strictEqual(pgSummaryRes.status, 200, 'PG summary must return 200');
    const pgSummary = (await pgSummaryRes.json()) as any;
    assert.strictEqual(pgSummary.success, true);

    const pgHostelCodes = pgSummary.hostels.map((h: any) => h.code);
    console.log('  PG Admin Facilities returned:', pgHostelCodes);
    assert(pgHostelCodes.length >= 2, 'PG Admin must see PG facilities');
    assert(pgHostelCodes.includes('OAK_HOUSE'));
    assert(pgHostelCodes.includes('MAPLE_VILLA'));
    assert(!pgHostelCodes.includes('GIRLS'), 'PG Admin must not see REC Girls');
    assert(!pgHostelCodes.includes('HABITAT'), 'PG Admin must not see REC Habitat');
    assert(!pgHostelCodes.includes('THANDALAM'), 'PG Admin must not see REC Thandalam');
    console.log('  ✅ PG Admin summary fields and environment isolation verified.');

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Test Cross-Environment Query Rejection (403 Forbidden)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 5] Verifying Cross-Environment Facility Access Restrictions...');
    const oakHouse = await prisma.hostel.findUnique({ where: { code: 'OAK_HOUSE' } });
    const habitat = await prisma.hostel.findUnique({ where: { code: 'HABITAT' } });
    assert(oakHouse && habitat, 'Hostel fixtures must exist');

    // REC Admin requesting PG facility
    const recCrossRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${oakHouse.id}`, {
      headers: { Authorization: `Bearer ${recToken}` },
    });
    assert.strictEqual(recCrossRes.status, 403, 'REC Admin querying PG facility must return 403');
    const recCrossJson = (await recCrossRes.json()) as any;
    assert.strictEqual(recCrossJson.success, false);

    // PG Admin requesting REC facility
    const pgCrossRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${habitat.id}`, {
      headers: { Authorization: `Bearer ${pgToken}` },
    });
    assert.strictEqual(pgCrossRes.status, 403, 'PG Admin querying REC facility must return 403');
    const pgCrossJson = (await pgCrossRes.json()) as any;
    assert.strictEqual(pgCrossJson.success, false);
    console.log('  ✅ Mutual cross-environment facility access strictly forbidden (403).');

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Verify Today's Slots Endpoint is Independent
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 6] Verifying GET /api/admin/slots/today independence...');
    const todaySlotsRes = await fetch(`${BASE_URL}/admin/slots/today`, {
      headers: { Authorization: `Bearer ${recToken}` },
    });
    assert.strictEqual(todaySlotsRes.status, 200, 'Today slots must return 200');
    const todaySlotsJson = (await todaySlotsRes.json()) as any;
    assert.strictEqual(todaySlotsJson.success, true);
    assert(Array.isArray(todaySlotsJson.slots), 'slots must be an array');
    assert(typeof todaySlotsJson.date === 'string', 'date must be a string');
    console.log('  ✅ Today slots endpoint functions independently.');

    // ──────────────────────────────────────────────────────────────────────────
    // 6. Test Error Sanitization for Database & Prisma Failures
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Step 7] Testing Error Middleware database sanitization...');
    let capturedStatus = 0;
    let capturedBody: any = null;

    const mockRes: any = {
      status(code: number) {
        capturedStatus = code;
        return this;
      },
      json(data: any) {
        capturedBody = data;
        return this;
      },
    };
    const mockNext = () => {};

    // Test A: Prisma P1001 unreachable error
    const p1001Error: any = new Error(
      "Can't reach database server at dpg-db0ftavavr4c73fh9b70-a.ohio-postgres.render.com:5432"
    );
    p1001Error.name = 'PrismaClientInitializationError';
    p1001Error.code = 'P1001';

    errorHandler(p1001Error, {} as any, mockRes, mockNext);
    assert.strictEqual(capturedStatus, 503, 'Database unreachable should return 503');
    assert.strictEqual(capturedBody.success, false);
    assert.strictEqual(
      capturedBody.message,
      'Database service is temporarily unavailable. Please try again shortly.'
    );
    assert(!JSON.stringify(capturedBody).includes('dpg-db0ftavavr4c73fh9b70-a'), 'Must not leak hostnames');
    assert(!JSON.stringify(capturedBody).includes('5432'), 'Must not leak port');
    assert(!capturedBody.stack, 'Must not return stack trace');

    // Test B: Prisma P2024 connection pool timeout
    const p2024Error: any = new Error('Timed out fetching a new connection from the connection pool');
    p2024Error.name = 'PrismaClientKnownRequestError';
    p2024Error.code = 'P2024';

    errorHandler(p2024Error, {} as any, mockRes, mockNext);
    assert.strictEqual(capturedStatus, 503, 'Pool timeout should return 503');
    assert.strictEqual(capturedBody.success, false);
    assert.strictEqual(
      capturedBody.message,
      'Database service is temporarily unavailable. Please try again shortly.'
    );

    // Test C: Generic application error preserves safe status
    const appError: any = new Error('Invalid query parameters');
    appError.statusCode = 400;

    errorHandler(appError, {} as any, mockRes, mockNext);
    assert.strictEqual(capturedStatus, 400, 'Application error preserves status 400');
    assert.strictEqual(capturedBody.message, 'Invalid query parameters');
    console.log('  ✅ Error middleware strictly sanitizes database failures without leaking secrets/hosts.');

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('  ALL ADMIN SUMMARY OPTIMIZATION & ERROR SAFETY TESTS PASSED!        ');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
  } finally {
    server.close();
  }
}

runAdminSummaryOptimizationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
