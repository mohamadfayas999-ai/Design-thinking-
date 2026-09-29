/**
 * WASHWISE Phase 2 API Tests
 * Run: npx tsx src/tests/phase2.test.ts
 */

const BASE = 'http://localhost:5000/api';

// ── Helpers ──────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function post(url: string, body: object, token?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json() };
}

async function get(url: string, token?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  return { status: r.status, data: await r.json() };
}

async function del(url: string, token?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'DELETE', headers });
  return { status: r.status, data: await r.json() };
}

async function loginStudent(email: string, hostelId: string): Promise<string> {
  const r = await post(`${BASE}/auth/login`, {
    email,
    password: 'rec123',
    role: 'STUDENT',
    hostelId,
  });
  if (!r.data.token) throw new Error(`Login failed for ${email}: ${r.data.message}`);
  return r.data.token;
}

// ── Get hostels ──────────────────────────────────────────────

async function getHostels() {
  const r = await get(`${BASE}/hostels`);
  return r.data.data as Array<{ id: string; name: string; code: string }>;
}

// ── Test Suites ──────────────────────────────────────────────

async function testAuthentication(hostels: any[]) {
  console.log('\n── Authentication Tests ──');
  const habitatHostel = hostels.find((h) => h.code === 'HABITAT');
  const tHandalamHostel = hostels.find((h) => h.code === 'THANDALAM');
  const girlsHostel = hostels.find((h) => h.code === 'GIRLS');

  // Valid login
  const r1 = await post(`${BASE}/auth/login`, {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: habitatHostel.id,
  });
  assert(r1.status === 200 && r1.data.success && r1.data.token, 'Student login succeeds with correct hostel');

  // Wrong password
  const r2 = await post(`${BASE}/auth/login`, {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    password: 'wrongpass',
    role: 'STUDENT',
    hostelId: habitatHostel.id,
  });
  assert(r2.status === 401 && !r2.data.success, 'Wrong password rejected');

  // Wrong hostel (Habitat student tries Girls)
  const r3 = await post(`${BASE}/auth/login`, {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: girlsHostel.id,
  });
  assert(r3.status === 401 && !r3.data.success, 'Wrong hostel selection rejected');

  // Staff cannot access student endpoints
  const staffR = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitatHostel.id,
  });
  const staffToken = staffR.data.token;
  const r4 = await get(`${BASE}/slots/available`, staffToken);
  assert(r4.status === 403 && !r4.data.success, 'Staff cannot access student slot endpoint');

  return { habitatHostel, tHandalamHostel, girlsHostel };
}

async function testHostelIsolation(hostels: any[]) {
  console.log('\n── Hostel Isolation Tests ──');
  const habitatHostel = hostels.find((h) => h.code === 'HABITAT');
  const tHandalamHostel = hostels.find((h) => h.code === 'THANDALAM');

  const habitatToken = await loginStudent('student.one.2024.csd@rajalakshmi.edu.in', habitatHostel.id);
  const tHandalamToken = await loginStudent('student.four.2024.ece@rajalakshmi.edu.in', tHandalamHostel.id);

  // Habitat student sees slots
  const r1 = await get(`${BASE}/slots/available`, habitatToken);
  assert(r1.status === 200 && r1.data.success && Array.isArray(r1.data.slots), 'Habitat student can get available slots');

  const habitatSlots = r1.data.slots as any[];

  // Thandalam student sees different slots
  const r2 = await get(`${BASE}/slots/available`, tHandalamToken);
  assert(r2.status === 200 && r2.data.success, 'Thandalam student can get available slots');

  const tHandalamSlots = r2.data.slots as any[];

  // Verify slots are different
  if (habitatSlots.length > 0 && tHandalamSlots.length > 0) {
    const habitatSlotIds = new Set(habitatSlots.map((s: any) => s.id));
    const hasOverlap = tHandalamSlots.some((s: any) => habitatSlotIds.has(s.id));
    assert(!hasOverlap, 'Habitat and Thandalam slots are completely separate');
  }

  // Habitat student cannot book Thandalam slot
  if (habitatSlots.length > 0 && tHandalamSlots.length > 0) {
    const tHandalamSlotId = tHandalamSlots[0].id;
    const r3 = await post(`${BASE}/slots/book`, {
      slotId: tHandalamSlotId,
      tShirtShirtCount: 5,
      pantsTrackCount: 3,
    }, habitatToken);
    assert(r3.status === 403 && !r3.data.success, 'Habitat student cannot book Thandalam slot');
  }

  return { habitatToken, tHandalamToken, habitatSlots };
}

async function testClothingValidation(habitatToken: string, habitatSlots: any[]) {
  console.log('\n── Clothing Count Validation Tests ──');

  if (habitatSlots.length === 0) {
    console.log('  ⚠ No available slots — skipping validation tests');
    return;
  }

  const slot = habitatSlots.find((s: any) => !s.isFull) || habitatSlots[0];
  const slotId = slot.id;

  // Total > 20 rejected
  const r1 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: 15,
    pantsTrackCount: 10,
  }, habitatToken);
  assert(r1.status === 400 && !r1.data.success, 'Total > 20 rejected');

  // Negative count rejected
  const r2 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: -1,
    pantsTrackCount: 5,
  }, habitatToken);
  assert(r2.status === 400 && !r2.data.success, 'Negative count rejected');

  // Zero total rejected
  const r3 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: 0,
    pantsTrackCount: 0,
  }, habitatToken);
  assert(r3.status === 400 && !r3.data.success, 'Zero total rejected');

  // Exactly 20 should succeed (we'll cancel after)
  const r4 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: 10,
    pantsTrackCount: 10,
  }, habitatToken);
  assert(r4.status === 201 && r4.data.success, 'Exactly 20 clothes accepted');

  // Cancel it for subsequent tests
  if (r4.data.booking?.id) {
    await del(`${BASE}/slots/cancel/${r4.data.booking.id}`, habitatToken);
  }
}

async function testBookingFlow(habitatToken: string, habitatSlots: any[]) {
  console.log('\n── Booking Flow Tests ──');

  if (habitatSlots.length === 0) {
    console.log('  ⚠ No available slots — skipping booking flow tests');
    return null;
  }

  const slot = habitatSlots.find((s: any) => !s.isFull) || habitatSlots[0];
  const slotId = slot.id;

  // Valid booking
  const r1 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: 6,
    pantsTrackCount: 4,
  }, habitatToken);
  assert(r1.status === 201 && r1.data.success && r1.data.booking, 'Valid booking created');

  const bookingId = r1.data.booking?.id;

  // Duplicate booking rejected
  const r2 = await post(`${BASE}/slots/book`, {
    slotId,
    tShirtShirtCount: 3,
    pantsTrackCount: 2,
  }, habitatToken);
  assert(r2.status === 409 && !r2.data.success, 'Duplicate/multiple active booking rejected');

  // Active booking visible on my-active
  const r3 = await get(`${BASE}/slots/my-active`, habitatToken);
  assert(r3.status === 200 && r3.data.booking?.id === bookingId, 'Active booking visible');
  // Verify no rack/shelf info leaks through
  assert(r3.data.booking?.rackShelf === undefined, 'Rack/shelf info hidden from student');

  return bookingId;
}

async function testCancellation(habitatToken: string, bookingId: string | null) {
  console.log('\n── Cancellation Tests ──');

  if (!bookingId) {
    console.log('  ⚠ No booking to cancel — skipping');
    return;
  }

  // Cancel own booking
  const r1 = await del(`${BASE}/slots/cancel/${bookingId}`, habitatToken);
  assert(r1.status === 200 && r1.data.success, 'BOOKED booking can be cancelled');

  // Cancel again should fail (no longer BOOKED)
  const r2 = await del(`${BASE}/slots/cancel/${bookingId}`, habitatToken);
  assert(r2.status === 400 && !r2.data.success, 'Already-cancelled booking cannot be cancelled twice');

  // Active booking should now be null
  const r3 = await get(`${BASE}/slots/my-active`, habitatToken);
  assert(r3.status === 200 && r3.data.booking === null, 'Active booking cleared after cancellation');
}

async function testOwnershipProtection(habitatToken: string, tHandalamToken: string, habitatSlots: any[]) {
  console.log('\n── Ownership Protection Tests ──');

  if (habitatSlots.length === 0) {
    console.log('  ⚠ No slots — skipping ownership tests');
    return;
  }

  const slot = habitatSlots.find((s: any) => !s.isFull) || habitatSlots[0];

  // Create booking with habitat student
  const r1 = await post(`${BASE}/slots/book`, {
    slotId: slot.id,
    tShirtShirtCount: 5,
    pantsTrackCount: 3,
  }, habitatToken);

  if (r1.data.booking?.id) {
    const bookingId = r1.data.booking.id;

    // Thandalam student tries to cancel Habitat student's booking
    const r2 = await del(`${BASE}/slots/cancel/${bookingId}`, tHandalamToken);
    assert(r2.status === 403 && !r2.data.success, 'Student cannot cancel another student\'s booking');

    // Cleanup
    await del(`${BASE}/slots/cancel/${bookingId}`, habitatToken);
  } else {
    console.log('  ⚠ Could not create test booking for ownership test');
  }
}

async function testMonthlyUsage(habitatToken: string) {
  console.log('\n── Monthly Usage Tests ──');

  const r = await get(`${BASE}/slots/usage`, habitatToken);
  assert(r.status === 200 && r.data.success && r.data.usage, 'Monthly usage endpoint works');
  assert(
    r.data.usage.maxCount === 4 &&
    typeof r.data.usage.usedCount === 'number' &&
    typeof r.data.usage.canBook === 'boolean',
    'Usage data has correct shape (max 4, usedCount, canBook)'
  );
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================');
  console.log('  WASHWISE Phase 2 — API Test Suite');
  console.log('========================================');

  try {
    const hostels = await getHostels();
    if (!hostels || hostels.length === 0) {
      throw new Error('No hostels found. Is the backend running and seeded?');
    }

    const { habitatHostel, tHandalamHostel } = await testAuthentication(hostels);
    const { habitatToken, tHandalamToken, habitatSlots } = await testHostelIsolation(hostels);
    await testClothingValidation(habitatToken, habitatSlots);
    const bookingId = await testBookingFlow(habitatToken, habitatSlots);
    await testCancellation(habitatToken, bookingId ?? null);
    await testOwnershipProtection(habitatToken, tHandalamToken, habitatSlots);
    await testMonthlyUsage(habitatToken);

    console.log('\n========================================');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('\n❌ Test suite error:', err.message);
    process.exit(1);
  }
}

main();
