/**
 * WASHWISE Final Targeted Refinement Tests
 * Run: npx tsx src/tests/refinement.test.ts
 *
 * Verifies:
 * 1. Intake lifecycle protection: Cannot call intake on already-intaked (IN_PROGRESS) or COMPLETED orders (HTTP 400).
 * 2. Immutable booked counts: Staff cannot modify student's booked counts during intake (HTTP 400).
 * 3. Verification succeeds when staff confirms matching counts and allocates rack (HTTP 200).
 */

const BASE = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    errors.push(message);
  }
}

async function safeJson(r: any, url: string) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'NON_JSON', raw: text };
  }
}

async function post(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await safeJson(r, url) };
}

async function get(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  return { status: r.status, data: await safeJson(r, url) };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — Targeted Refinement Verification Test Suite');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. Fetch hostels
  console.log('1. Fetch Hostels & Setup Auth');
  const hostelsRes = await get(`${BASE}/hostels`);
  assert(hostelsRes.status === 200, 'Fetched hostels list');
  const hostels = hostelsRes.data.data || [];
  const habitat = hostels.find((h: any) => h.code === 'HABITAT');
  assert(!!habitat, 'Found Habitat hostel');

  // Student login
  const studentLogin = await post(`${BASE}/auth/login`, {
    email: 'student.two.2024.cse@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: habitat.id,
  });
  assert(studentLogin.status === 200, 'Student login succeeded');
  const studentToken = studentLogin.data.token;

  // Staff login
  const staffLogin = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitat.id,
  });
  assert(staffLogin.status === 200, 'Habitat staff login succeeded');
  const staffToken = staffLogin.data.token;

  // 2. Fetch available slots
  console.log('\n2. Setup Booking with Exact Declared Clothing Counts');
  const slotsRes = await get(`${BASE}/slots/available`, studentToken);
  assert(slotsRes.status === 200, 'Fetched student slots');
  const slots = slotsRes.data.slots || [];
  const targetSlot = slots.find((s: any) => !s.isFull) || slots[0];
  assert(!!targetSlot, 'Found slot for booking');

  // Create booking with 5 shirts and 3 pants (Total = 8)
  const bookedShirts = 5;
  const bookedPants = 3;
  const bookRes = await post(`${BASE}/slots/book`, {
    slotId: targetSlot.id,
    tShirtShirtCount: bookedShirts,
    pantsTrackCount: bookedPants,
  }, studentToken);

  assert(bookRes.status === 201, `Student created booking with ${bookedShirts} shirts and ${bookedPants} pants`);
  const bookingId = bookRes.data.booking?.id;
  assert(!!bookingId, 'Obtained booking ID');

  // 3. Find an available storage rack/shelf
  const storageRes = await get(`${BASE}/staff/storage`, staffToken);
  assert(storageRes.status === 200, 'Fetched staff storage locations');
  const storageList = storageRes.data.storage || [];
  const availableRack = storageList.find((s: any) => !s.isOccupied);
  assert(!!availableRack, `Found available rack/shelf location: ${availableRack?.label}`);

  // 4. Test CHANGE 2: Staff attempts to alter booked counts during intake -> MUST FAIL
  console.log('\n3. Testing Change 2: Staff Cannot Modify Booked Clothing Counts');
  const alteredIntakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
    tShirtShirtCount: 4, // Student booked 5, staff attempts to record 4
    pantsTrackCount: 3,
    rackShelfId: availableRack.id,
  }, staffToken);

  assert(
    alteredIntakeRes.status === 400,
    `Altered intake count rejected by backend with HTTP 400 (Status: ${alteredIntakeRes.status})`
  );
  assert(
    alteredIntakeRes.data.message?.includes('Staff cannot alter booked clothing quantities') ||
    alteredIntakeRes.data.message?.includes('does not match'),
    'Backend returned discrepancy rejection message'
  );

  // 5. Test CHANGE 2 Verification: Staff confirms matching counts -> MUST SUCCEED
  console.log('\n4. Testing Change 2 Verification: Confirming Matching Counts & Allocating Rack');
  const validIntakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
    tShirtShirtCount: bookedShirts, // Exactly 5
    pantsTrackCount: bookedPants,   // Exactly 3
    rackShelfId: availableRack.id,
  }, staffToken);

  assert(
    validIntakeRes.status === 200,
    `Verified intake succeeded with matching counts (Status: ${validIntakeRes.status})`
  );
  assert(
    validIntakeRes.data.order?.status === 'IN_PROGRESS',
    'Order successfully transitioned to IN_PROGRESS'
  );
  assert(
    validIntakeRes.data.order?.itemCount?.isLocked === true,
    'ItemCount is now locked and immutable'
  );

  // 6. Test CHANGE 3 Backend Protection: Calling intake again on IN_PROGRESS order -> MUST FAIL
  console.log('\n5. Testing Change 3 Backend Protection: Disallowing Intake on IN_PROGRESS Order');
  const repeatIntakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
    tShirtShirtCount: bookedShirts,
    pantsTrackCount: bookedPants,
    rackShelfId: availableRack.id,
  }, staffToken);

  assert(
    repeatIntakeRes.status === 400,
    `Repeat intake rejected with HTTP 400 (Status: ${repeatIntakeRes.status})`
  );
  assert(
    repeatIntakeRes.data.message?.includes('IN_PROGRESS') ||
    repeatIntakeRes.data.message?.includes('cannot be taken into intake again'),
    'Backend correctly stated order is already in progress / cannot be taken into intake again'
  );

  // 7. Complete the order
  console.log('\n6. Testing Change 3 Backend Protection: Disallowing Intake on COMPLETED Order');
  const orderId = validIntakeRes.data.order?.id;
  const completeRes = await post(`${BASE}/staff/orders/${orderId}/complete`, {}, staffToken);
  assert(completeRes.status === 200, 'Order marked as COMPLETED by staff');

  // Attempt intake on COMPLETED order -> MUST FAIL
  const intakeOnCompletedRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
    tShirtShirtCount: bookedShirts,
    pantsTrackCount: bookedPants,
    rackShelfId: availableRack.id,
  }, staffToken);

  assert(
    intakeOnCompletedRes.status === 400,
    `Intake on COMPLETED order rejected with HTTP 400 (Status: ${intakeOnCompletedRes.status})`
  );
  assert(
    intakeOnCompletedRes.data.message?.includes('COMPLETED') ||
    intakeOnCompletedRes.data.message?.includes('cannot be taken into intake again'),
    'Backend correctly rejected intake on COMPLETED order'
  );

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  Tests Completed: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log('  ALL TARGETED REFINEMENT TESTS PASSED 100%!');
  } else {
    console.error('  Failed assertions:');
    errors.forEach((e) => console.error(`    - ${e}`));
  }
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
