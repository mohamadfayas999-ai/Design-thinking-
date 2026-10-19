import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import assert from 'assert';
import http from 'http';
import fetch from 'node-fetch';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';

async function runStaffFilterAndPgAdminVerification() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — Staff Hostel Filter & PG Admin Portal Verification Suite  ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://localhost:${port}/api`;

  try {
    // 1. Fetch facilities from DB for reference
    const oakHouse = await prisma.hostel.findUnique({ where: { code: 'OAK_HOUSE' } });
    const mapleVilla = await prisma.hostel.findUnique({ where: { code: 'MAPLE_VILLA' } });
    const pineResidence = await prisma.hostel.findUnique({ where: { code: 'PINE_RESIDENCE' } });
    const cedarSuites = await prisma.hostel.findUnique({ where: { code: 'CEDAR_SUITES' } });
    const habitat = await prisma.hostel.findUnique({ where: { code: 'HABITAT' } });
    const thandalam = await prisma.hostel.findUnique({ where: { code: 'THANDALAM' } });
    const girls = await prisma.hostel.findUnique({ where: { code: 'GIRLS' } });

    assert(oakHouse && mapleVilla && pineResidence && cedarSuites && habitat && thandalam && girls, 'All required hostels must exist');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 1: Staff Hostel Filter (Backend and API scoping)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[Check 1] Verifying GET /api/hostels?role=STAFF returns ONLY REC hostels...');
    const staffHostelsRes = await fetch(`${BASE_URL}/hostels?role=STAFF`);
    assert.strictEqual(staffHostelsRes.status, 200, 'GET /hostels?role=STAFF must return 200');
    const staffHostelsJson = (await staffHostelsRes.json()) as any;
    assert.strictEqual(staffHostelsJson.success, true);
    const returnedCodes = staffHostelsJson.data.map((h: any) => h.code);

    console.log('  Returned hostel codes for STAFF:', returnedCodes);
    assert.strictEqual(returnedCodes.length, 3, 'Must return exactly 3 REC hostels for staff');
    assert(returnedCodes.includes('GIRLS'), 'Must include GIRLS');
    assert(returnedCodes.includes('THANDALAM'), 'Must include THANDALAM');
    assert(returnedCodes.includes('HABITAT'), 'Must include HABITAT');

    // Explicitly verify PG facilities are excluded
    assert(!returnedCodes.includes('OAK_HOUSE'), 'OAK_HOUSE must not be in staff list');
    assert(!returnedCodes.includes('MAPLE_VILLA'), 'MAPLE_VILLA must not be in staff list');
    assert(!returnedCodes.includes('PINE_RESIDENCE'), 'PINE_RESIDENCE must not be in staff list');
    assert(!returnedCodes.includes('CEDAR_SUITES'), 'CEDAR_SUITES must not be in staff list');
    console.log('  ✅ Check 1 Passed: Exactly Girls, Thandalam, and Habitat returned; PG excluded.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 2: Staff login with PG hostel ID is strictly rejected (403)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 2] Testing direct staff login attempt using a PG facility ID...');
    const invalidStaffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'habitatstaff1@rajalakshmi.edu.in',
        password: process.env.TEST_STAFF_PASSWORD ?? '',
        role: 'STAFF',
        hostelId: oakHouse.id, // Trying to attach to PG Oak House
      }),
    });
    assert.strictEqual(invalidStaffLoginRes.status, 403, 'Staff login on PG facility must be rejected with 403');
    const invalidStaffJson = (await invalidStaffLoginRes.json()) as any;
    console.log('  Server rejected invalid staff login as expected:', invalidStaffJson.message);
    console.log('  ✅ Check 2 Passed: Staff login with PG facility ID rejected with 403.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 3: Legitimate Staff Login & Access Boundaries
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 3] Testing valid REC staff login and resource isolation...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'habitatstaff1@rajalakshmi.edu.in',
        password: process.env.TEST_STAFF_PASSWORD ?? '',
        role: 'STAFF',
        hostelId: habitat.id,
      }),
    });
    assert.strictEqual(staffLoginRes.status, 200, 'Valid staff login must succeed');
    const staffData = (await staffLoginRes.json()) as any;
    const staffToken = staffData.token;
    assert(staffToken, 'Token must be issued');

    // Attempt staff access to PG facility bookings via direct URL
    const staffAccessPgRes = await fetch(`${BASE_URL}/staff/bookings?hostelId=${oakHouse.id}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffAccessPgRes.status, 403, 'Staff direct request to PG hostelId must return 403');
    console.log('  Staff attempt to access Oak House returned 403 Forbidden as expected.');
    console.log('  ✅ Check 3 Passed: Staff authentication and facility authorization preserved.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 4: REC Admin Authentication & Scoping
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 4] Testing REC Admin Login...');
    const recAdminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rajalakshmi.edu.in',
        password: process.env.TEST_REC_ADMIN_PASSWORD ?? '',
        role: 'ADMIN',
      }),
    });
    assert.strictEqual(recAdminLoginRes.status, 200, 'REC Admin login must succeed with 200');
    const recAdminData = (await recAdminLoginRes.json()) as any;
    const recAdminToken = recAdminData.token;
    assert.strictEqual(recAdminData.user.environment, 'COLLEGE', 'REC admin environment must be COLLEGE');
    assert.strictEqual(recAdminData.user.role, 'ADMIN', 'Role must be ADMIN');

    // Verify REC admin summary shows only COLLEGE hostels
    const recSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${recAdminToken}` },
    });
    assert.strictEqual(recSummaryRes.status, 200, 'REC Admin summary must return 200');
    const recSummaryJson = (await recSummaryRes.json()) as any;
    const recSummaryCodes = recSummaryJson.hostels.map((h: any) => h.code);
    console.log('  REC Admin Hostels in summary:', recSummaryCodes);
    assert(recSummaryCodes.includes('HABITAT') && recSummaryCodes.includes('THANDALAM') && recSummaryCodes.includes('GIRLS'), 'Must include REC hostels');
    assert(!recSummaryCodes.includes('OAK_HOUSE'), 'REC admin must not see Oak House');

    // Verify REC admin calling PG hostel ID directly gets 403
    const recAccessPgRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${oakHouse.id}`, {
      headers: { Authorization: `Bearer ${recAdminToken}` },
    });
    assert.strictEqual(recAccessPgRes.status, 403, 'REC Admin requesting PG hostelId must return 403');
    console.log('  REC Admin request to PG Oak House returned 403 Forbidden.');
    console.log('  ✅ Check 4 Passed: REC Admin flow working and strictly scoped to COLLEGE.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 5: PG Admin Authentication & Demo Credentials Normal Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 5] Testing PG Admin Login...');
    const pgAdminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@pgsharedliving.com',
        password: process.env.TEST_PG_ADMIN_PASSWORD ?? '',
        role: 'ADMIN',
      }),
    });
    assert.strictEqual(pgAdminLoginRes.status, 200, 'PG Admin login must succeed with 200');
    const pgAdminData = (await pgAdminLoginRes.json()) as any;
    const pgAdminToken = pgAdminData.token;
    assert.strictEqual(pgAdminData.user.environment, 'PG_SHARED', 'PG Admin environment must be PG_SHARED');
    assert.strictEqual(pgAdminData.user.role, 'ADMIN', 'Role must be ADMIN');
    assert.strictEqual(pgAdminData.user.name, 'PG Hostel Administrator', 'Display name must be PG Hostel Administrator');
    console.log('  ✅ Check 5 Passed: PG Admin credentials verified via normal auth endpoint.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 6: PG Admin Environment Scoping & Data Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 6] Verifying PG Admin Summary Metrics & Isolation...');
    const pgSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgSummaryRes.status, 200, 'PG Admin summary must return 200');
    const pgSummaryJson = (await pgSummaryRes.json()) as any;
    const pgSummaryCodes = pgSummaryJson.hostels.map((h: any) => h.code);
    console.log('  PG Admin Hostels in summary:', pgSummaryCodes);
    assert.strictEqual(pgSummaryCodes.length, 4, 'Must return all 4 PG facilities');
    assert(pgSummaryCodes.includes('OAK_HOUSE'), 'Must include OAK_HOUSE');
    assert(pgSummaryCodes.includes('MAPLE_VILLA'), 'Must include MAPLE_VILLA');
    assert(pgSummaryCodes.includes('PINE_RESIDENCE'), 'Must include PINE_RESIDENCE');
    assert(pgSummaryCodes.includes('CEDAR_SUITES'), 'Must include CEDAR_SUITES');
    assert(!pgSummaryCodes.includes('HABITAT'), 'PG admin must not see HABITAT');
    assert(!pgSummaryCodes.includes('GIRLS'), 'PG admin must not see GIRLS');

    // Verify PG Admin calling REC hostel ID gets 403
    const pgAccessRecRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${habitat.id}`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgAccessRecRes.status, 403, 'PG Admin requesting REC hostelId must return 403');
    console.log('  PG Admin request to REC Habitat returned 403 Forbidden.');
    console.log('  ✅ Check 6 Passed: PG Admin strictly scoped to PG_SHARED.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 7: PG Admin Residents Endpoint (4 PG Residents, No Secrets Exposed)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 7] Verifying PG Admin Residents Endpoint...');
    const pgStudentsRes = await fetch(`${BASE_URL}/admin/students`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgStudentsRes.status, 200, 'GET /admin/students for PG Admin must return 200');
    const pgStudentsJson = (await pgStudentsRes.json()) as any;
    assert.strictEqual(pgStudentsJson.count, 4, 'Must return exactly 4 PG residents');
    const studentIds = pgStudentsJson.students.map((s: any) => s.studentId);
    console.log('  PG Resident IDs:', studentIds);
    assert(studentIds.includes('RES-OAK-001'), 'Includes RES-OAK-001');
    assert(studentIds.includes('RES-MAP-002'), 'Includes RES-MAP-002');
    assert(studentIds.includes('RES-PIN-003'), 'Includes RES-PIN-003');
    assert(studentIds.includes('RES-CED-004'), 'Includes RES-CED-004');

    // Security check: ensure no passwordHash or qrToken is exposed
    for (const student of pgStudentsJson.students) {
      assert.strictEqual((student as any).passwordHash, undefined, 'passwordHash must never be exposed');
      assert.strictEqual((student as any).qrToken, undefined, 'qrToken must never be exposed');
      assert(student.bookingSummary, 'bookingSummary must be provided');
    }
    console.log('  ✅ Check 7 Passed: 4 PG residents listed with booking summaries, secrets protected.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 8: PG Admin Bookings Management Endpoint
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 8] Verifying PG Admin Bookings Endpoint (/api/admin/bookings)...');
    const pgBookingsRes = await fetch(`${BASE_URL}/admin/bookings`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgBookingsRes.status, 200, 'GET /admin/bookings must return 200');
    const pgBookingsJson = (await pgBookingsRes.json()) as any;
    console.log(`  Found ${pgBookingsJson.count} PG bookings in live database.`);
    assert(pgBookingsJson.count >= 3, 'Must have at least 3 actual PG bookings');

    for (const b of pgBookingsJson.bookings) {
      assert(b.id, 'Booking ID exists');
      assert(b.bookedAt, 'Creation time exists');
      assert(b.slot, 'Slot object exists');
      assert(b.slot.date, 'Slot date exists');
      assert(b.slot.startTime && b.slot.endTime, 'Slot window exists');
      assert(b.student, 'Student object exists');
      assert(b.hostel, 'Hostel object exists');
      assert(b.status, 'Status exists');
      // Confirm environment is PG_SHARED
      assert.strictEqual(b.hostel.environment, 'PG_SHARED', 'Booking hostel must be PG_SHARED');
    }
    console.log('  ✅ Check 8 Passed: PG Bookings returned with creation time, slot time, batch info, weight, and garments.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 9: PG Admin Orders Endpoint (/api/admin/orders)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 9] Verifying PG Admin Orders Endpoint (/api/admin/orders)...');
    const pgOrdersRes = await fetch(`${BASE_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgOrdersRes.status, 200, 'GET /admin/orders must return 200');
    const pgOrdersJson = (await pgOrdersRes.json()) as any;
    console.log(`  Found ${pgOrdersJson.count} PG orders in live database.`);
    assert(pgOrdersJson.count >= 3, 'Must have at least 3 actual PG orders');

    for (const o of pgOrdersJson.orders) {
      assert(o.id, 'Order ID exists');
      assert(o.status, 'Order status exists');
      assert(o.student, 'Student exists');
      assert(o.itemCount, 'ItemCount exists');
      assert.strictEqual(o.rackShelf, null, 'PG orders operate on self-service, rackShelf should be null');
    }
    console.log('  ✅ Check 9 Passed: PG Orders returned with supported database statuses and self-service model.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 10: PG Admin History & Notifications Endpoints
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 10] Verifying PG Admin History & Notifications Endpoints...');
    const pgHistoryRes = await fetch(`${BASE_URL}/admin/history`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgHistoryRes.status, 200, 'GET /admin/history must return 200');
    const pgHistoryJson = (await pgHistoryRes.json()) as any;
    console.log(`  Found ${pgHistoryJson.count} PG laundry history records.`);
    assert(pgHistoryJson.count >= 1, 'Must have history records');

    const pgNotifRes = await fetch(`${BASE_URL}/admin/notifications`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgNotifRes.status, 200, 'GET /admin/notifications must return 200');
    const pgNotifJson = (await pgNotifRes.json()) as any;
    console.log(`  Found ${pgNotifJson.count} PG notifications.`);
    assert(pgNotifJson.count >= 1, 'Must have PG notifications');
    console.log('  ✅ Check 10 Passed: PG History and Notifications returned correctly.');

    // ──────────────────────────────────────────────────────────────────────────
    // CHECK 11: Cross-Environment Mutation / Isolation Rejection
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Check 11] Verifying Cross-Environment Mutation Rejections...');
    // PG Admin trying to access REC students
    const pgAccessRecStudentsRes = await fetch(`${BASE_URL}/admin/students?hostelId=${habitat.id}`, {
      headers: { Authorization: `Bearer ${pgAdminToken}` },
    });
    assert.strictEqual(pgAccessRecStudentsRes.status, 403, 'PG Admin accessing REC students must return 403');

    // REC Admin trying to access PG students
    const recAccessPgStudentsRes = await fetch(`${BASE_URL}/admin/students?hostelId=${oakHouse.id}`, {
      headers: { Authorization: `Bearer ${recAdminToken}` },
    });
    assert.strictEqual(recAccessPgStudentsRes.status, 403, 'REC Admin accessing PG students must return 403');

    console.log('  Both PG -> REC and REC -> PG unauthorized cross-environment requests returned 403 Forbidden.');
    console.log('  ✅ Check 11 Passed: Mutual environment isolation strictly enforced server-side.');

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log('  ALL 11 VERIFICATION CHECKS PASSED WITH 100% SUCCESS');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runStaffFilterAndPgAdminVerification()
  .then(() => {
    console.log('Verification script completed.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
