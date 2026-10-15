import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { requireEnvironment, requireHostelAccess } from '../middlewares/auth.middleware.js';
import { Role, EnvironmentType } from '../types/models.js';

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
  console.log('  WASHWISE — End-to-End Environment Isolation Verification     ');
  console.log('  (Testing COLLEGE vs PG_SHARED Isolation & Security Bounds)   ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Verify baseline record counts with retry for network stability
  let baselineHostelCount = 0;
  let baselineUserCount = 0;
  let baselineStudentCount = 0;
  let baselineBookingCount = 0;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      baselineHostelCount = await prisma.hostel.count();
      baselineUserCount = await prisma.user.count();
      baselineStudentCount = await prisma.studentProfile.count();
      baselineBookingCount = await prisma.slotBooking.count();
      break;
    } catch (e: any) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Spin up an ephemeral HTTP server on a random free port (port 0)
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://localhost:${port}/api`;

  try {
    // ────────────────────────────────────────────────────────
    // SECTION 1: JWT & Token Environment Integrity
    // ────────────────────────────────────────────────────────
    console.log('--- 1. JWT & Token Environment Integrity ---');

    const collegeToken = signToken({
      userId: 'test-college-id',
      email: 'admin@rajalakshmi.edu.in',
      role: Role.ADMIN,
      environment: EnvironmentType.COLLEGE,
    });
    const collegeDecoded = verifyToken(collegeToken);
    assert(collegeDecoded !== null, 'COLLEGE token verifies successfully');
    assert(collegeDecoded?.environment === EnvironmentType.COLLEGE, 'Decoded token preserves environment: COLLEGE');

    const pgToken = signToken({
      userId: 'test-pg-id',
      email: 'admin@pgsharedliving.com',
      role: Role.ADMIN,
      environment: EnvironmentType.PG_SHARED,
    });
    const pgDecoded = verifyToken(pgToken);
    assert(pgDecoded !== null, 'PG_SHARED token verifies successfully');
    assert(pgDecoded?.environment === EnvironmentType.PG_SHARED, 'Decoded token preserves environment: PG_SHARED');

    // ────────────────────────────────────────────────────────
    // SECTION 2: Middleware Unit Isolation
    // ────────────────────────────────────────────────────────
    console.log('\n--- 2. Middleware Unit Isolation ---');

    let mwNextCalled = false;
    const reqCollege: any = { user: { role: Role.ADMIN, environment: EnvironmentType.COLLEGE } };
    const resMock: any = {
      statusCode: 200,
      jsonPayload: null,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.jsonPayload = data; return this; },
    };

    const requireCollegeMw = requireEnvironment([EnvironmentType.COLLEGE]);
    requireCollegeMw(reqCollege, resMock, () => { mwNextCalled = true; });
    assert(mwNextCalled, 'requireEnvironment allows user with matching COLLEGE environment');

    mwNextCalled = false;
    resMock.statusCode = 200;
    const reqPg: any = { user: { role: Role.ADMIN, environment: EnvironmentType.PG_SHARED } };
    requireCollegeMw(reqPg, resMock, () => { mwNextCalled = true; });
    assert(!mwNextCalled && resMock.statusCode === 403, 'requireEnvironment rejects user with PG_SHARED environment (HTTP 403)');

    const collegeHostel = await prisma.hostel.findFirst({ where: { environment: 'COLLEGE' } });
    const pgHostel = await prisma.hostel.findFirst({ where: { environment: 'PG_SHARED' } });
    assert(!!collegeHostel && !!pgHostel, 'Found both COLLEGE and PG_SHARED facilities in database');

    mwNextCalled = false;
    resMock.statusCode = 200;
    await requireHostelAccess({ ...reqCollege, params: { hostelId: collegeHostel!.id } }, resMock, () => { mwNextCalled = true; });
    assert(mwNextCalled, 'requireHostelAccess allows COLLEGE admin accessing COLLEGE hostel');

    mwNextCalled = false;
    resMock.statusCode = 200;
    await requireHostelAccess({ ...reqPg, params: { hostelId: collegeHostel!.id } }, resMock, () => { mwNextCalled = true; });
    assert(!mwNextCalled && resMock.statusCode === 403, 'requireHostelAccess rejects PG_SHARED admin accessing COLLEGE hostel (HTTP 403)');

    mwNextCalled = false;
    resMock.statusCode = 200;
    await requireHostelAccess({ ...reqCollege, params: { hostelId: pgHostel!.id } }, resMock, () => { mwNextCalled = true; });
    assert(!mwNextCalled && resMock.statusCode === 403, 'requireHostelAccess rejects COLLEGE admin accessing PG hostel (HTTP 403)');

    // ────────────────────────────────────────────────────────
    // SECTION 3: Authentication & Metadata Integrity
    // ────────────────────────────────────────────────────────
    console.log('\n--- 3. Authentication & Metadata Integrity ---');

    // 3A: REC Admin Login
    const recAdminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@rajalakshmi.edu.in',
        password: 'admin123',
        role: 'ADMIN',
      }),
    });
    const recAdminData = await recAdminLoginRes.json();
    assert(recAdminLoginRes.status === 200, 'REC Admin login succeeds');
    assert(recAdminData.user?.environment === EnvironmentType.COLLEGE, 'REC Admin login response includes environment: COLLEGE');

    // 3B: PG Admin Login
    const pgAdminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@pgsharedliving.com',
        password: 'pgadmin123',
        role: 'ADMIN',
      }),
    });
    const pgAdminData = await pgAdminLoginRes.json();
    assert(pgAdminLoginRes.status === 200, 'PG Admin login succeeds');
    assert(pgAdminData.user?.environment === EnvironmentType.PG_SHARED, 'PG Admin login response includes environment: PG_SHARED');

    // Verify /api/auth/me for PG Admin
    const pgMeRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${pgAdminData.token}` },
    });
    const pgMeData = await pgMeRes.json();
    assert(pgMeRes.status === 200, 'GET /api/auth/me for PG Admin succeeds');
    assert(pgMeData.user?.environment === EnvironmentType.PG_SHARED, 'GET /api/auth/me returns environment: PG_SHARED');

    // Forged token rejection
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@rajalakshmi.edu.in' } });
    const forgedToken = signToken({
      userId: adminUser!.id,
      email: adminUser!.email,
      role: Role.ADMIN,
      environment: EnvironmentType.PG_SHARED,
    });
    const forgedRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${forgedToken}` },
    });
    assert(forgedRes.status === 401, 'requireAuth rejects forged token where token environment does not match database user environment');

    // ────────────────────────────────────────────────────────
    // SECTION 4: HTTP Hostels Filtering & Protection
    // ────────────────────────────────────────────────────────
    console.log('\n--- 4. HTTP Hostels Filtering & Protection ---');

    // 4A: Public unauthenticated endpoints
    const resAllHostels = await fetch(`${BASE_URL}/hostels`);
    const dataAllHostels = await resAllHostels.json();
    assert(resAllHostels.status === 200 && dataAllHostels.data.length === 7, 'Public GET /api/hostels returns all 7 facilities (3 COLLEGE + 4 PG_SHARED)');

    const resCollegeHostels = await fetch(`${BASE_URL}/hostels?environment=COLLEGE`);
    const dataCollegeHostels = await resCollegeHostels.json();
    assert(resCollegeHostels.status === 200 && dataCollegeHostels.data.length === 3, 'Public GET /api/hostels?environment=COLLEGE returns exactly 3 COLLEGE hostels');

    const resPgHostels = await fetch(`${BASE_URL}/hostels?environment=PG_SHARED`);
    const dataPgHostels = await resPgHostels.json();
    assert(resPgHostels.status === 200 && dataPgHostels.data.length === 4, 'Public GET /api/hostels?environment=PG_SHARED returns exactly 4 PG facilities');

    // 4B: Authenticated environment scoping prevents query param overrides
    const resAdminCollegeHostels = await fetch(`${BASE_URL}/hostels?environment=PG_SHARED`, {
      headers: { Authorization: `Bearer ${recAdminData.token}` },
    });
    const dataAdminCollegeHostels = await resAdminCollegeHostels.json();
    assert(
      resAdminCollegeHostels.status === 200 && dataAdminCollegeHostels.data.length === 3,
      'Authenticated COLLEGE admin cannot override environment via query param (returns only 3 COLLEGE hostels)'
    );

    const resAdminPgHostels = await fetch(`${BASE_URL}/hostels?environment=COLLEGE`, {
      headers: { Authorization: `Bearer ${pgAdminData.token}` },
    });
    const dataAdminPgHostels = await resAdminPgHostels.json();
    assert(
      resAdminPgHostels.status === 200 && dataAdminPgHostels.data.length === 4,
      'Authenticated PG admin cannot override environment via query param (returns only 4 PG facilities)'
    );

    // ────────────────────────────────────────────────────────
    // SECTION 5: Admin Endpoints Isolation & Scoping
    // ────────────────────────────────────────────────────────
    console.log('\n--- 5. Admin Endpoints Isolation & Scoping ---');

    // REC Admin summary
    const recSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${recAdminData.token}` },
    });
    const recSummaryData = await recSummaryRes.json();
    assert(recSummaryRes.status === 200, 'REC Admin accesses /api/admin/summary successfully');
    assert(recSummaryData.hostels.length === 3, 'REC Admin summary contains only COLLEGE hostels (3 hostels)');
    assert(recSummaryData.summary.totalStudents === 9, 'REC Admin summary sees exactly 9 COLLEGE students');

    // REC Admin attempting cross-environment access to PG facility
    const recCrossHostelRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${pgHostel!.id}`, {
      headers: { Authorization: `Bearer ${recAdminData.token}` },
    });
    assert(recCrossHostelRes.status === 403, 'REC Admin requesting summary for PG facility is rejected (HTTP 403)');

    // PG Admin summary
    const pgSummaryRes = await fetch(`${BASE_URL}/admin/summary`, {
      headers: { Authorization: `Bearer ${pgAdminData.token}` },
    });
    const pgSummaryData = await pgSummaryRes.json();
    assert(pgSummaryRes.status === 200, 'PG Admin accesses /api/admin/summary successfully');
    assert(pgSummaryData.hostels.length === 4, 'PG Admin summary contains only 4 PG facilities (zero COLLEGE hostels)');
    assert(pgSummaryData.summary.totalStudents === 4, 'PG Admin summary sees exactly 4 PG residents (zero COLLEGE students)');
    assert(pgSummaryData.summary.totalStaff === 0, 'PG Admin summary sees 0 staff (zero COLLEGE staff)');

    // PG Admin attempting cross-environment access to COLLEGE facility
    const pgCrossHostelRes = await fetch(`${BASE_URL}/admin/summary?hostelId=${collegeHostel!.id}`, {
      headers: { Authorization: `Bearer ${pgAdminData.token}` },
    });
    assert(pgCrossHostelRes.status === 403, 'PG Admin requesting summary for COLLEGE facility is rejected (HTTP 403)');

    // REC Admin students list
    const recStudentsRes = await fetch(`${BASE_URL}/admin/students`, {
      headers: { Authorization: `Bearer ${recAdminData.token}` },
    });
    const recStudentsData = await recStudentsRes.json();
    assert(recStudentsData.count === 9, 'REC Admin sees exactly 9 students (all COLLEGE)');
    assert(recStudentsData.students.every((s: any) => s.hostel.environment === 'COLLEGE'), 'All students returned to REC Admin are in COLLEGE environment');

    // PG Admin students list
    const pgStudentsRes = await fetch(`${BASE_URL}/admin/students`, {
      headers: { Authorization: `Bearer ${pgAdminData.token}` },
    });
    const pgStudentsData = await pgStudentsRes.json();
    assert(pgStudentsData.count === 4, 'PG Admin sees exactly 4 residents (all PG_SHARED)');
    assert(pgStudentsData.students.every((s: any) => s.hostel.environment === 'PG_SHARED'), 'All residents returned to PG Admin are in PG_SHARED environment');

    // ────────────────────────────────────────────────────────
    // SECTION 6: Resident Slot Booking & Cross-Environment Protection
    // ────────────────────────────────────────────────────────
    console.log('\n--- 6. Resident Slot Booking & Cross-Environment Protection ---');

    // 6A: PG Resident Login
    const pgResidentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user1@gmail.com',
        password: 'user1',
        role: 'STUDENT',
        hostelId: pgHostel!.id,
      }),
    });
    const pgResidentData = await pgResidentLoginRes.json();
    assert(pgResidentLoginRes.status === 200, 'PG Resident login succeeds');
    assert(pgResidentData.user?.environment === EnvironmentType.PG_SHARED, 'PG Resident user has environment: PG_SHARED');

    // 6B: PG Resident attempting to book COLLEGE slot
    const collegeSlot = await prisma.laundrySlot.findFirst({
      where: { hostel: { environment: 'COLLEGE' } },
    });
    assert(!!collegeSlot, 'Found COLLEGE slot for cross-environment booking attempt');

    const crossEnvBookRes = await fetch(`${BASE_URL}/slots/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pgResidentData.token}`,
      },
      body: JSON.stringify({
        slotId: collegeSlot!.id,
        tShirtShirtCount: 2,
        pantsTrackCount: 2,
      }),
    });
    assert(crossEnvBookRes.status === 403, 'PG Resident attempting to book COLLEGE slot is rejected (HTTP 403)');

    // 6C: REC Student attempting to book PG slot
    const recStudent = await prisma.user.findFirst({
      where: { role: Role.STUDENT, environment: 'COLLEGE' },
      include: { studentProfile: true },
    });
    const recStudentLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: recStudent!.email,
        password: 'rec123',
        role: 'STUDENT',
        hostelId: recStudent!.studentProfile!.hostelId,
      }),
    });
    const recStudentData = await recStudentLogin.json();

    const pgSlot = await prisma.laundrySlot.findFirst({
      where: { hostel: { environment: 'PG_SHARED' } },
    });
    assert(!!pgSlot, 'Found PG slot for cross-environment booking attempt');

    const crossEnvBookRes2 = await fetch(`${BASE_URL}/slots/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recStudentData.token}`,
      },
      body: JSON.stringify({
        slotId: pgSlot!.id,
        tShirtShirtCount: 2,
        pantsTrackCount: 2,
      }),
    });
    assert(crossEnvBookRes2.status === 403, 'REC Student attempting to book PG slot is rejected (HTTP 403)');

    // ────────────────────────────────────────────────────────
    // SECTION 7: Zero Database Writes Verification During Test Suite
    // ────────────────────────────────────────────────────────
    console.log('\n--- 7. Zero Database Writes Audit (Test Suite Run) ---');
    const afterHostelCount = await prisma.hostel.count();
    const afterUserCount = await prisma.user.count();
    const afterStudentCount = await prisma.studentProfile.count();
    const afterBookingCount = await prisma.slotBooking.count();

    assert(afterHostelCount === baselineHostelCount, `Hostel count unchanged (${baselineHostelCount})`);
    assert(afterUserCount === baselineUserCount, `User count unchanged (${baselineUserCount})`);
    assert(afterStudentCount === baselineStudentCount, `Student count unchanged (${baselineStudentCount})`);
    assert(afterBookingCount === baselineBookingCount, `Booking count unchanged (${baselineBookingCount})`);

  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Phase 2B Isolation Verification Suite: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
