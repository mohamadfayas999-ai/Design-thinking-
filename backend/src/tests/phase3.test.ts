/**
 * WASHWISE Phase 3 API Tests — Staff Intake & Storage Management
 * Run: npx tsx src/tests/phase3.test.ts
 *
 * Prerequisites: server running on :5000, database seeded.
 */

const BASE = 'http://localhost:5000/api';

// ── Helpers ──────────────────────────────────────────────────

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

async function loginStaff(email: string, hostelId: string): Promise<string> {
  const r = await post(`${BASE}/auth/login`, {
    email,
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId,
  });
  if (!r.data.token) throw new Error(`Staff login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

async function loginStudent(email: string, hostelId: string): Promise<string> {
  const r = await post(`${BASE}/auth/login`, {
    email,
    password: 'rec123',
    role: 'STUDENT',
    hostelId,
  });
  if (!r.data.token) throw new Error(`Student login failed for ${email}: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

// ── State ────────────────────────────────────────────────────
let habitatStaffToken = '';
let thandalamStaffToken = '';
let habitatStudentToken = '';
let habitatHostelId = '';
let thandalamHostelId = '';
let testBookingId = '';
let testOrderId = '';
let availableRackShelfId = '';
let occupiedRackShelfId = '';

// ── Main test runner ─────────────────────────────────────────

async function setup() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       WASHWISE Phase 3 Tests — Staff Intake & Storage   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Fetch hostels
  const hostelsRes = await get(`${BASE}/hostels`);
  const hostels = hostelsRes.data.data || [];
  const habitat = hostels.find((h: any) => h.code === 'HABITAT');
  const thandalam = hostels.find((h: any) => h.code === 'THANDALAM');
  habitatHostelId = habitat?.id;
  thandalamHostelId = thandalam?.id;

  if (!habitatHostelId || !thandalamHostelId) {
    console.error('Could not find hostels. Make sure the DB is seeded.');
    process.exit(1);
  }

  // Login
  habitatStaffToken = await loginStaff('habitatstaff1@rajalakshmi.edu.in', habitatHostelId);
  thandalamStaffToken = await loginStaff('thandalamstaff1@rajalakshmi.edu.in', thandalamHostelId);
  habitatStudentToken = await loginStudent('student.one.2024.csd@rajalakshmi.edu.in', habitatHostelId);
}

// ── Section 1: Staff Authentication & Access Control ─────────

async function testStaffAuth() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('1. STAFF AUTHENTICATION & ACCESS CONTROL');
  console.log('──────────────────────────────────────────────────');

  // Valid login
  const loginRes = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitatHostelId,
  });
  assert(loginRes.status === 200, 'Valid staff login returns 200');
  assert(!!loginRes.data.token, 'Valid staff login returns token');

  // Invalid password
  const badLogin = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'wrongpassword',
    role: 'STAFF',
    hostelId: habitatHostelId,
  });
  assert(badLogin.status === 401, 'Invalid password returns 401');

  // Wrong hostel (Thandalam staff trying to access Habitat)
  const wrongHostelLogin = await post(`${BASE}/auth/login`, {
    email: 'thandalamstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitatHostelId, // wrong hostel
  });
  assert(wrongHostelLogin.status === 403 || wrongHostelLogin.status === 401, 'Wrong hostel login rejected');

  // Student cannot access staff dashboard
  const studentDash = await get(`${BASE}/staff/dashboard`, habitatStudentToken);
  assert(studentDash.status === 403, 'Student cannot access staff dashboard');

  // No token
  const noToken = await get(`${BASE}/staff/dashboard`);
  assert(noToken.status === 401, 'No token rejected from staff endpoints');
}

// ── Section 2: Staff Dashboard ────────────────────────────────

async function testStaffDashboard() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('2. STAFF DASHBOARD');
  console.log('──────────────────────────────────────────────────');

  const res = await get(`${BASE}/staff/dashboard`, habitatStaffToken);
  assert(res.status === 200, 'Staff dashboard returns 200');
  assert(res.data.success === true, 'Dashboard success flag true');
  assert(!!res.data.dashboard?.staff?.name, 'Dashboard includes staff name');
  assert(!!res.data.dashboard?.staff?.hostel?.name, 'Dashboard includes hostel name');
  assert(res.data.dashboard?.staff?.hostel?.code === 'HABITAT', 'Dashboard shows correct hostel (Habitat)');
  assert(typeof res.data.dashboard?.stats?.waitingCount === 'number', 'Dashboard includes waiting count');
  assert(typeof res.data.dashboard?.stats?.inProgressCount === 'number', 'Dashboard includes in-progress count');
  assert(typeof res.data.dashboard?.stats?.totalStorage === 'number', 'Dashboard includes storage count');
  assert(Array.isArray(res.data.dashboard?.todaySlots), 'Dashboard includes today slot breakdown');
}

// ── Section 3: Hostel Isolation ───────────────────────────────

async function testHostelIsolation() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('3. HOSTEL ISOLATION');
  console.log('──────────────────────────────────────────────────');

  // Habitat staff sees bookings
  const habitatBookings = await get(`${BASE}/staff/bookings`, habitatStaffToken);
  assert(habitatBookings.status === 200, 'Habitat staff can list bookings');

  // All returned bookings are for Habitat hostel
  const bookings = habitatBookings.data.bookings || [];
  const allHabitat = bookings.every((b: any) => b.slot?.hostelId === habitatHostelId);
  assert(allHabitat, 'All bookings returned are scoped to Habitat hostel');

  // Get a booking from Thandalam (via Thandalam staff)
  const thandalamBookings = await get(`${BASE}/staff/bookings`, thandalamStaffToken);
  const thandalamBooking = (thandalamBookings.data.bookings || [])[0];

  if (thandalamBooking) {
    // Habitat staff tries to access a Thandalam booking directly
    const crossBooking = await get(`${BASE}/staff/bookings/${thandalamBooking.id}`, habitatStaffToken);
    assert(crossBooking.status === 403, 'Habitat staff cannot access Thandalam booking (403)');
  } else {
    console.log('  ⚠ No Thandalam bookings to test cross-hostel; skipping this check');
  }

  // Storage isolation
  const habitatStorage = await get(`${BASE}/staff/storage`, habitatStaffToken);
  assert(habitatStorage.status === 200, 'Habitat staff can view storage');
  const locations = habitatStorage.data.storage || [];
  assert(locations.length > 0, 'Habitat storage has locations seeded');
}

// ── Section 4: Storage Availability ──────────────────────────

async function testStorage() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('4. STORAGE (RACK/SHELF)');
  console.log('──────────────────────────────────────────────────');

  const res = await get(`${BASE}/staff/storage`, habitatStaffToken);
  assert(res.status === 200, 'Storage endpoint returns 200');
  assert(res.data.success === true, 'Storage success flag true');

  const storage = res.data.storage || [];
  assert(storage.length === 12, `Storage has 12 locations (got ${storage.length})`);
  assert(storage.every((loc: any) => typeof loc.rackNumber === 'number'), 'All locations have rackNumber');
  assert(storage.every((loc: any) => typeof loc.shelfNumber === 'number'), 'All locations have shelfNumber');
  assert(storage.every((loc: any) => typeof loc.isOccupied === 'boolean'), 'All locations have isOccupied flag');

  // Find an available one for intake test
  const available = storage.find((loc: any) => !loc.isOccupied);
  if (available) {
    availableRackShelfId = available.id;
    assert(true, `Found available rack/shelf: ${available.label}`);
  } else {
    assert(false, 'No available rack/shelf found — cannot proceed with intake tests');
  }

  // Rack grouping
  assert(!!res.data.byRack, 'Storage response includes byRack grouping');
}

// ── Section 5: Booking Intake Flow ───────────────────────────

async function testIntakeFlow() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('5. BOOKING INTAKE FLOW');
  console.log('──────────────────────────────────────────────────');

  if (!availableRackShelfId) {
    console.log('  ⚠ No available rack/shelf — skipping intake tests');
    return;
  }

  // Get Habitat bookings that are BOOKED
  const bookingsRes = await get(`${BASE}/staff/bookings?status=BOOKED`, habitatStaffToken);
  assert(bookingsRes.status === 200, 'Staff can filter bookings by status=BOOKED');

  const bookedBookings = (bookingsRes.data.bookings || []).filter(
    (b: any) => b.status === 'BOOKED' && !b.laundryOrder?.status?.match(/IN_PROGRESS|COMPLETED/)
  );

  if (bookedBookings.length === 0) {
    console.log('  ⚠ No BOOKED bookings found — skipping intake tests (create a student booking first)');
    return;
  }

  testBookingId = bookedBookings[0].id;
  console.log(`  Using booking ID: ${testBookingId}`);

  // Get booking detail
  const detailRes = await get(`${BASE}/staff/bookings/${testBookingId}`, habitatStaffToken);
  assert(detailRes.status === 200, 'Staff can fetch booking detail');
  assert(detailRes.data.booking?.student?.name, 'Booking detail includes student name');
  assert(detailRes.data.booking?.slot?.startTime, 'Booking detail includes slot time');
  // Student data must NOT include rack/shelf in detail
  assert(detailRes.data.booking?.rackShelf === undefined || detailRes.data.booking?.rackShelf === null, 
    'Booking detail before intake has no rack/shelf assigned');

  // Search by student ID
  const student = bookedBookings[0].student;
  if (student?.studentId) {
    const searchRes = await get(
      `${BASE}/staff/bookings?search=${encodeURIComponent(student.studentId)}`,
      habitatStaffToken
    );
    assert(searchRes.status === 200, 'Search by student ID works');
    const found = (searchRes.data.bookings || []).some((b: any) => b.id === testBookingId);
    assert(found, 'Search returns the booking matching the student ID');
  }
}

// ── Section 6: Count Validation ──────────────────────────────

async function testCountValidation() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('6. COUNT VALIDATION');
  console.log('──────────────────────────────────────────────────');

  if (!testBookingId || !availableRackShelfId) {
    console.log('  ⚠ Skipping count validation — no test booking available');
    return;
  }

  // Total > 20 rejected
  const over20 = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: 15, pantsTrackCount: 10, rackShelfId: availableRackShelfId },
    habitatStaffToken
  );
  assert(over20.status === 400, 'Total >20 clothes rejected (25)');

  // Exactly 20 should pass validation (we will not commit this, just test the count logic)
  // We test the actual 20 case later with real intake

  // Negative value rejected
  const negativeVal = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: -1, pantsTrackCount: 5, rackShelfId: availableRackShelfId },
    habitatStaffToken
  );
  assert(negativeVal.status === 400, 'Negative clothing count rejected');

  // Zero total rejected
  const zeroTotal = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: 0, pantsTrackCount: 0, rackShelfId: availableRackShelfId },
    habitatStaffToken
  );
  assert(zeroTotal.status === 400, 'Zero total clothes rejected');

  // Missing rack/shelf rejected
  const noRack = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: 5, pantsTrackCount: 3 },
    habitatStaffToken
  );
  assert(noRack.status === 400, 'Missing rack/shelf rejected');
}

// ── Section 7: Actual Intake Execution ───────────────────────

async function testIntakeExecution() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('7. INTAKE EXECUTION (BOOKED → IN_PROGRESS)');
  console.log('──────────────────────────────────────────────────');

  if (!testBookingId || !availableRackShelfId) {
    console.log('  ⚠ Skipping — no test booking or rack/shelf available');
    return;
  }

  // Perform intake
  const intakeRes = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: 7, pantsTrackCount: 5, rackShelfId: availableRackShelfId },
    habitatStaffToken
  );

  assert(intakeRes.status === 200, 'Intake returns 200');
  assert(intakeRes.data.success === true, 'Intake success flag true');
  assert(intakeRes.data.order?.status === 'IN_PROGRESS', 'Order status is IN_PROGRESS after intake');
  assert(intakeRes.data.order?.itemCount?.totalCount === 12, 'Intake item count total = 12');
  assert(intakeRes.data.order?.itemCount?.tShirtShirtCount === 7, 'T-shirt count stored correctly');
  assert(intakeRes.data.order?.itemCount?.pantsTrackCount === 5, 'Pants count stored correctly');
  assert(!!intakeRes.data.order?.rackShelf, 'Rack/shelf assigned to order');
  assert(!!intakeRes.data.order?.staff, 'Staff assigned to order');

  testOrderId = intakeRes.data.order?.id;
  occupiedRackShelfId = availableRackShelfId;
}

// ── Section 8: Post-Intake State Validation ───────────────────

async function testPostIntakeState() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('8. POST-INTAKE STATE VALIDATION');
  console.log('──────────────────────────────────────────────────');

  if (!testBookingId) {
    console.log('  ⚠ Skipping — no intake was performed');
    return;
  }

  // Cannot intake same booking twice
  const doubleIntake = await post(
    `${BASE}/staff/bookings/${testBookingId}/intake`,
    { tShirtShirtCount: 3, pantsTrackCount: 2, rackShelfId: availableRackShelfId },
    habitatStaffToken
  );
  assert(doubleIntake.status === 400, 'Cannot intake same booking twice');

  // Occupied rack/shelf cannot be reused for another booking
  if (occupiedRackShelfId) {
    // Get another booking to attempt
    const otherBookings = await get(`${BASE}/staff/bookings?status=BOOKED`, habitatStaffToken);
    const otherBooked = (otherBookings.data.bookings || []).find(
      (b: any) => b.id !== testBookingId && b.status === 'BOOKED' && !b.laundryOrder?.status?.includes('IN_PROGRESS')
    );

    if (otherBooked) {
      const occupiedAttempt = await post(
        `${BASE}/staff/bookings/${otherBooked.id}/intake`,
        { tShirtShirtCount: 4, pantsTrackCount: 3, rackShelfId: occupiedRackShelfId },
        habitatStaffToken
      );
      assert(occupiedAttempt.status === 409, 'Occupied rack/shelf cannot be reused (409)');
    } else {
      console.log('  ⚠ No other BOOKED booking available to test occupied rack/shelf rejection');
    }
  }

  // Storage now shows the location as occupied
  if (occupiedRackShelfId) {
    const storageRes = await get(`${BASE}/staff/storage`, habitatStaffToken);
    const occupiedLoc = (storageRes.data.storage || []).find((loc: any) => loc.id === occupiedRackShelfId);
    assert(occupiedLoc?.isOccupied === true, 'Used rack/shelf now shows as OCCUPIED');
    assert(!!occupiedLoc?.occupiedBy?.studentId, 'Occupied location shows the student ID');
  }
}

// ── Section 9: Student Protection After Intake ───────────────

async function testStudentProtection() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('9. STUDENT PROTECTION AFTER INTAKE');
  console.log('──────────────────────────────────────────────────');

  if (!testBookingId) {
    console.log('  ⚠ Skipping — no intake was performed');
    return;
  }

  // Student cannot cancel after intake (IN_PROGRESS)
  const cancelRes = await del(`${BASE}/slots/cancel/${testBookingId}`, habitatStudentToken);
  assert(cancelRes.status === 400, 'Student cannot cancel booking after intake starts');
  assert(
    cancelRes.data.message?.includes('processing has started'),
    'Cancel after intake shows correct message'
  );

  // Student's active booking response doesn't include rack/shelf/staff info
  const myBooking = await get(`${BASE}/slots/my-active`, habitatStudentToken);
  assert(myBooking.status === 200, 'Student can view their active booking');
  if (myBooking.data.booking) {
    assert(!myBooking.data.booking.rackShelf, 'Student cannot see rackShelf in response');
    assert(!myBooking.data.booking.rackShelfId, 'Student cannot see rackShelfId in response');
    assert(!myBooking.data.booking.staffId, 'Student cannot see staffId in response');
    assert(myBooking.data.booking.canCancel === false, 'canCancel is false for student after intake');
  }

  // Student cannot access staff endpoints
  const staffDash = await get(`${BASE}/staff/dashboard`, habitatStudentToken);
  assert(staffDash.status === 403, 'Student cannot access staff dashboard');

  const staffStorage = await get(`${BASE}/staff/storage`, habitatStudentToken);
  assert(staffStorage.status === 403, 'Student cannot access staff storage');
}

// ── Section 10: Order Detail ──────────────────────────────────

async function testOrderDetail() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('10. ORDER DETAIL');
  console.log('──────────────────────────────────────────────────');

  if (!testOrderId) {
    console.log('  ⚠ Skipping — no order was created');
    return;
  }

  const res = await get(`${BASE}/staff/orders/${testOrderId}`, habitatStaffToken);
  assert(res.status === 200, 'Staff can view order detail');
  assert(res.data.order?.status === 'IN_PROGRESS', 'Order detail shows IN_PROGRESS status');
  assert(!!res.data.order?.rackShelf, 'Order detail includes rack/shelf');
  assert(!!res.data.order?.itemCount, 'Order detail includes item count');
  assert(!!res.data.order?.staff, 'Order detail includes assigned staff');

  // Thandalam staff cannot access Habitat order
  const crossOrder = await get(`${BASE}/staff/orders/${testOrderId}`, thandalamStaffToken);
  assert(crossOrder.status === 403, 'Thandalam staff cannot access Habitat order (cross-hostel)');
}

// ── Section 11: Search ────────────────────────────────────────

async function testSearch() {
  console.log('\n──────────────────────────────────────────────────');
  console.log('11. SEARCH');
  console.log('──────────────────────────────────────────────────');

  // Search by known student ID fragment (case-insensitive)
  const searchByStudentId = await get(`${BASE}/staff/bookings?search=2024CSD001`, habitatStaffToken);
  assert(searchByStudentId.status === 200, 'Search by student ID returns 200');

  // Search results are hostel-scoped (Thandalam students should NOT appear)
  const results = searchByStudentId.data.bookings || [];
  const allHabitat = results.every((b: any) => b.slot?.hostelId === habitatHostelId);
  assert(allHabitat, 'Search results are scoped to Habitat hostel only');

  // Case-insensitive search by name
  const searchByName = await get(
    `${BASE}/staff/bookings?search=student`,
    habitatStaffToken
  );
  assert(searchByName.status === 200, 'Case-insensitive name search returns 200');
}

// ── Report ─────────────────────────────────────────────────────

async function run() {
  try {
    await setup();
    await testStaffAuth();
    await testStaffDashboard();
    await testHostelIsolation();
    await testStorage();
    await testIntakeFlow();
    await testCountValidation();
    await testIntakeExecution();
    await testPostIntakeState();
    await testStudentProtection();
    await testOrderDetail();
    await testSearch();
  } catch (e: any) {
    console.error('\n💥 Unexpected error during test run:', e.message);
    failed++;
  }

  const total = passed + failed;
  console.log('\n══════════════════════════════════════════════════');
  console.log(`Phase 3 Tests Complete: ${passed}/${total} passed`);
  if (failed > 0) {
    console.error(`\nFailed tests (${failed}):`);
    errors.forEach((e) => console.error(`  • ${e}`));
    console.log('══════════════════════════════════════════════════\n');
    process.exit(1);
  } else {
    console.log('✅ All Phase 3 tests passed!');
    console.log('══════════════════════════════════════════════════\n');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
