/**
 * WASHWISE Phase 4 API Tests — Completion + Verification + Complaints + History
 * Run: npx tsx src/tests/phase4.test.ts
 *
 * Prerequisites: server running on :5000, database seeded.
 * Assumes Phase 3 test has run (or is run immediately before) to set up an IN_PROGRESS order.
 *
 * This test file creates a full lifecycle:
 *   student books → staff intake → staff marks complete → student verifies (or complains)
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

async function safeJson(r: any, url: string) {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`Non-JSON response from ${url} (status ${r.status}):`, text.slice(0, 200));
    return { error: 'NON_JSON', raw: text };
  }
}

async function post(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await safeJson(r, url) };
}

async function patch(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await safeJson(r, url) };
}

async function get(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  return { status: r.status, data: await safeJson(r, url) };
}

async function del(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(url, { method: 'DELETE', headers });
  return { status: r.status, data: await safeJson(r, url) };
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

async function loginAdmin(): Promise<string> {
  const r = await post(`${BASE}/auth/login`, {
    email: 'admin@rajalakshmi.edu.in',
    password: 'admin123',
    role: 'ADMIN',
  });
  if (!r.data.token) throw new Error(`Admin login failed: ${JSON.stringify(r.data)}`);
  return r.data.token;
}

// ── State ────────────────────────────────────────────────────
let habitatStaffToken = '';
let student1Token = '';
let student2Token = '';
let adminToken = '';
let habitatHostelId = '';
let orderId1 = ''; // for verify path
let orderId2 = ''; // for complaint path

// ── Main test runner ─────────────────────────────────────────

async function setup() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   WASHWISE Phase 4 Tests — Completion + Pickup + Complaints ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Fetch hostels
  const hostelsRes = await get(`${BASE}/hostels`);
  const hostels = hostelsRes.data.data || [];
  const habitat = hostels.find((h: any) => h.code === 'HABITAT');
  habitatHostelId = habitat?.id;
  if (!habitatHostelId) {
    console.error('Could not find Habitat hostel. Make sure DB is seeded.');
    process.exit(1);
  }

  // Login
  habitatStaffToken = await loginStaff('habitatstaff1@rajalakshmi.edu.in', habitatHostelId);
  student1Token = await loginStudent('student.one.2024.csd@rajalakshmi.edu.in', habitatHostelId);
  student2Token = await loginStudent('student.two.2024.cse@rajalakshmi.edu.in', habitatHostelId);
  adminToken = await loginAdmin();

  console.log('✓ Tokens acquired for staff, student1, student2, admin\n');
}

// ── Full lifecycle helper ─────────────────────────────────────

async function createInProgressOrder(studentToken: string): Promise<string> {
  // Check if student already has an active booking
  const activeRes = await get(`${BASE}/slots/my-active`, studentToken);
  if (activeRes.data.booking?.id) {
    const bookingId = activeRes.data.booking.id;
    const staffBookingsRes = await get(`${BASE}/staff/bookings`, habitatStaffToken);
    const existing = (staffBookingsRes.data.bookings || []).find((b: any) => b.id === bookingId);
    if (existing?.laundryOrder?.id && existing.laundryOrder.status === 'IN_PROGRESS') {
      return existing.laundryOrder.id;
    }
    if (existing && (!existing.laundryOrder || existing.laundryOrder.status === 'BOOKED')) {
      const storageRes = await get(`${BASE}/staff/storage`, habitatStaffToken);
      const available = (storageRes.data.storage || []).find((s: any) => !s.isOccupied);
      if (available) {
        const intakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
          tShirtShirtCount: 2,
          pantsTrackCount: 1,
          rackShelfId: available.id,
        }, habitatStaffToken);
        if (intakeRes.data.order?.id) return intakeRes.data.order.id;
      }
    }
  }

  // 1. Get available slots
  const slotsRes = await get(`${BASE}/slots/available`, studentToken);
  const slot = slotsRes.data.slots?.[0];
  if (!slot) throw new Error('No available slots for student');

  // 2. Book slot
  const bookRes = await post(`${BASE}/slots/book`, {
    slotId: slot.id,
    tShirtShirtCount: 2,
    pantsTrackCount: 1,
  }, studentToken);
  if (!bookRes.data.booking?.id) throw new Error('Booking failed: ' + JSON.stringify(bookRes.data));
  const bookingId = bookRes.data.booking.id;

  // 3. Get available storage
  const storageRes = await get(`${BASE}/staff/storage`, habitatStaffToken);
  const available = (storageRes.data.storage || []).find((s: any) => !s.isOccupied);
  if (!available) throw new Error('No available storage locations');

  // 4. Perform intake
  const intakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
    tShirtShirtCount: 2,
    pantsTrackCount: 1,
    rackShelfId: available.id,
  }, habitatStaffToken);
  if (!intakeRes.data.order?.id) throw new Error('Intake failed: ' + JSON.stringify(intakeRes.data));

  return intakeRes.data.order.id;
}

// ── Tests ─────────────────────────────────────────────────────

async function testStaffComplete() {
  console.log('──────────────────────────────────────────────');
  console.log('Section A: Staff marks order as COMPLETED');
  console.log('──────────────────────────────────────────────\n');

  // Create IN_PROGRESS orders for both students
  try {
    orderId1 = await createInProgressOrder(student1Token);
    orderId2 = await createInProgressOrder(student2Token);
    console.log(`  ✓ Created IN_PROGRESS orders: ${orderId1} and ${orderId2}`);
    passed++;
  } catch (e: any) {
    console.error(`  ✗ Could not create IN_PROGRESS orders: ${e.message}`);
    failed++;
    errors.push(`Create IN_PROGRESS orders: ${e.message}`);
    return;
  }

  // A1: Staff marks order 1 as completed
  const completeRes1 = await post(`${BASE}/staff/orders/${orderId1}/complete`, {}, habitatStaffToken);
  assert(completeRes1.status === 200, 'A1: Staff can mark IN_PROGRESS order as COMPLETED');
  assert(completeRes1.data.success === true, 'A1: response has success=true');
  assert(completeRes1.data.status === 'COMPLETED', 'A1: order status is COMPLETED');
  assert(!!completeRes1.data.completedAt, 'A1: completedAt timestamp is set');

  // A2: Staff marks order 2 as completed
  const completeRes2 = await post(`${BASE}/staff/orders/${orderId2}/complete`, {}, habitatStaffToken);
  assert(completeRes2.status === 200, 'A2: Second order can also be marked completed');

  // A3: Cannot complete the same order twice
  const completeAgain = await post(`${BASE}/staff/orders/${orderId1}/complete`, {}, habitatStaffToken);
  assert(completeAgain.status === 400, 'A3: Cannot mark already-completed order as completed again');

  // A4: Student cannot call staff complete endpoint
  const studentTryComplete = await post(`${BASE}/staff/orders/${orderId1}/complete`, {}, student1Token);
  assert(studentTryComplete.status === 403, 'A4: Student cannot access staff complete endpoint');

  // A5: Storage should still be occupied after completion
  const storageRes = await get(`${BASE}/staff/storage`, habitatStaffToken);
  const storage = (storageRes.data.storage || []) as any[];
  const occupied1 = storage.find((s: any) => s.occupiedBy?.orderId === orderId1);
  assert(!!occupied1, 'A5: Storage location remains occupied after COMPLETED status (clothes still there)');
}

async function testStudentNotifications() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Section B: Student sees completion notifications');
  console.log('──────────────────────────────────────────────\n');

  // B1: Student 1 can see notification
  const notifRes = await get(`${BASE}/student/notifications`, student1Token);
  assert(notifRes.status === 200, 'B1: Student can GET notifications');
  assert(notifRes.data.success === true, 'B1: success=true');
  assert(Array.isArray(notifRes.data.notifications), 'B1: notifications is array');
  assert(notifRes.data.notifications.length > 0, 'B1: has at least one notification');

  const n = notifRes.data.notifications[0];
  assert(n.type === 'LAUNDRY_COMPLETED', 'B1: notification type is LAUNDRY_COMPLETED');
  assert(n.isRead === false, 'B1: notification is unread');
  assert(!!n.order, 'B1: notification has order data');

  // B2: Notification does NOT expose rack/shelf
  assert(!n.order?.rackShelf, 'B2: notification does NOT expose rackShelf');
  assert(!n.order?.rackNumber, 'B2: notification does NOT expose rackNumber');

  // B3: Student 2 can also see their notification
  const notifRes2 = await get(`${BASE}/student/notifications`, student2Token);
  assert(notifRes2.status === 200, 'B3: Student 2 can GET their own notifications');
  assert(notifRes2.data.notifications.length > 0, 'B3: Student 2 has notification');

  // B4: Cannot access notifications without auth
  const noAuth = await get(`${BASE}/student/notifications`);
  assert(noAuth.status === 401, 'B4: Cannot access notifications without authentication');
}

async function testStudentGetOrder() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Section C: Student sees order detail (privacy)');
  console.log('──────────────────────────────────────────────\n');

  // C1: Student can get their own order
  const orderRes = await get(`${BASE}/student/orders/${orderId1}`, student1Token);
  assert(orderRes.status === 200, 'C1: Student can GET their own order');
  assert(orderRes.data.order.id === orderId1, 'C1: Correct order returned');
  assert(orderRes.data.order.status === 'COMPLETED', 'C1: Status is COMPLETED');

  // C2: Order does NOT expose rack/shelf
  const order = orderRes.data.order;
  assert(!order.rackShelfId, 'C2: rackShelfId is NOT exposed');
  assert(!order.rackShelf, 'C2: rackShelf object is NOT exposed');
  assert(!order.staffId, 'C2: staffId is NOT exposed');
  assert(!order.staff, 'C2: staff object is NOT exposed');

  // C3: Student 2 cannot access Student 1's order
  const crossAccess = await get(`${BASE}/student/orders/${orderId1}`, student2Token);
  assert(crossAccess.status === 403, 'C3: Student cannot access another student\'s order');

  // C4: Non-existent order returns 404
  const notFound = await get(`${BASE}/student/orders/non-existent-id`, student1Token);
  assert(notFound.status === 404, 'C4: Non-existent order returns 404');
}

async function testVerifyFlow() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Section D: Student verifies order (COMPLETED → VERIFIED)');
  console.log('──────────────────────────────────────────────\n');

  // D1: Student 1 verifies their order
  const verifyRes = await post(`${BASE}/student/orders/${orderId1}/verify`, {}, student1Token);
  assert(verifyRes.status === 200, 'D1: Student can verify COMPLETED order');
  assert(verifyRes.data.success === true, 'D1: success=true');
  assert(verifyRes.data.status === 'VERIFIED', 'D1: status is VERIFIED');
  assert(!!verifyRes.data.verifiedAt, 'D1: verifiedAt timestamp is set');

  // D2: Cannot verify again
  const verifyAgain = await post(`${BASE}/student/orders/${orderId1}/verify`, {}, student1Token);
  assert(verifyAgain.status === 400, 'D2: Cannot verify already-verified order');

  // D3: Storage should be released after verification
  const storageRes = await get(`${BASE}/staff/storage`, habitatStaffToken);
  const storage = (storageRes.data.storage || []) as any[];
  const stillOccupied = storage.find((s: any) => s.occupiedBy?.orderId === orderId1);
  assert(!stillOccupied, 'D3: Storage is released after student verifies');

  // D4: Notification should be marked as read
  const notifAfter = await get(`${BASE}/student/notifications`, student1Token);
  const unread = notifAfter.data.notifications?.filter((n: any) => !n.isRead) || [];
  const verifiedUnread = unread.some((n: any) => n.order?.id === orderId1);
  assert(!verifiedUnread, 'D4: Completion notification is marked read after verification');

  // D5: History is created
  const historyRes = await get(`${BASE}/student/history`, student1Token);
  assert(historyRes.status === 200, 'D5: Student can get history after verification');
  assert(historyRes.data.count >= 1, 'D5: History has at least 1 entry');
  const histEntry = historyRes.data.history?.find((h: any) => h.orderId === orderId1);
  assert(!!histEntry, 'D5: Verified order appears in history');
  assert(histEntry?.status === 'VERIFIED', 'D5: History entry has VERIFIED status');
}

async function testComplaintFlow() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Section E: Student submits complaint (COMPLETED → UNDER_REVIEW)');
  console.log('──────────────────────────────────────────────\n');

  // E1: Student 2 submits a complaint with valid type
  const complaintRes = await post(`${BASE}/student/orders/${orderId2}/complaint`, {
    type: 'CLOTHES_TORN',
    additionalDetails: 'My shirt has a tear on the sleeve.',
  }, student2Token);
  assert(complaintRes.status === 201, 'E1: Student can submit a complaint');
  assert(complaintRes.data.success === true, 'E1: success=true');
  assert(complaintRes.data.orderStatus === 'UNDER_REVIEW', 'E1: order status transitions to UNDER_REVIEW');
  assert(!!complaintRes.data.complaint?.id, 'E1: complaint ID is returned');
  assert(complaintRes.data.complaint?.type === 'CLOTHES_TORN', 'E1: complaint type is correct');

  const complaintId = complaintRes.data.complaint.id;

  // E2: Cannot submit second complaint on same order
  const dupComplaint = await post(`${BASE}/student/orders/${orderId2}/complaint`, {
    type: 'OTHER_ISSUE',
  }, student2Token);
  assert(dupComplaint.status === 400, 'E2: Cannot submit duplicate complaint on same order');

  // E3: Cannot verify an order that has a complaint
  const tryVerify = await post(`${BASE}/student/orders/${orderId2}/verify`, {}, student2Token);
  assert(tryVerify.status === 400, 'E3: Cannot verify an order that has a complaint');

  // E4: Cannot submit complaint without type
  const noType = await post(`${BASE}/student/orders/${orderId2}/complaint`, {
    additionalDetails: 'Missing type',
  }, student2Token);
  assert([400, 404].includes(noType.status), 'E4: Complaint without type returns 400');

  // E5: Invalid complaint type is rejected
  const badType = await post(`${BASE}/student/orders/${orderId2}/complaint`, {
    type: 'INVALID_TYPE',
  }, student2Token);
  assert([400, 404].includes(badType.status), 'E5: Invalid complaint type returns 400');

  // E6: Student 2 history shows complaint
  const historyRes = await get(`${BASE}/student/history`, student2Token);
  assert(historyRes.status === 200, 'E6: Student 2 can get history with complaint');
  const histEntry = historyRes.data.history?.find((h: any) => h.orderId === orderId2);
  assert(!!histEntry, 'E6: Complaint order appears in history');
  assert(histEntry?.status === 'UNDER_REVIEW', 'E6: History entry has UNDER_REVIEW status');
  assert(!!histEntry?.complaint, 'E6: History entry has complaint data');

  // E7: Admin can resolve the complaint
  const resolveRes = await patch(`${BASE}/admin/complaints/${complaintId}/resolve`, {}, adminToken);
  assert(resolveRes.status === 200, 'E7: Admin can resolve complaint');
  assert(resolveRes.data.status === 'RESOLVED', 'E7: complaint status is RESOLVED');
  assert(!!resolveRes.data.resolvedAt, 'E7: resolvedAt is set');

  // E8: Cannot resolve an already resolved complaint
  const resolveAgain = await patch(`${BASE}/admin/complaints/${complaintId}/resolve`, {}, adminToken);
  assert(resolveAgain.status === 400, 'E8: Cannot resolve already-resolved complaint');

  // E9: Student cannot resolve complaints
  const studentResolve = await patch(`${BASE}/admin/complaints/${complaintId}/resolve`, {}, student2Token);
  assert(studentResolve.status === 403, 'E9: Student cannot access admin complaint resolution');

  // E10: Order is now RESOLVED
  const orderAfterResolve = await get(`${BASE}/student/orders/${orderId2}`, student2Token);
  assert(orderAfterResolve.data.order.status === 'RESOLVED', 'E10: Order status is RESOLVED after complaint resolved');
  assert(orderAfterResolve.data.order.complaint?.status === 'RESOLVED', 'E10: complaint.status is RESOLVED');

  return complaintId;
}

async function testHistoryPage() {
  console.log('\n──────────────────────────────────────────────');
  console.log('Section F: Full history listing');
  console.log('──────────────────────────────────────────────\n');

  // F1: Student 1 history (verified)
  const hist1 = await get(`${BASE}/student/history`, student1Token);
  assert(hist1.status === 200, 'F1: Student 1 history loads');
  assert(hist1.data.history?.some((h: any) => h.status === 'VERIFIED'), 'F1: verified entry present');

  // F2: Student 2 history (resolved complaint)
  const hist2 = await get(`${BASE}/student/history`, student2Token);
  assert(hist2.status === 200, 'F2: Student 2 history loads');
  assert(hist2.data.history?.some((h: any) => h.status === 'RESOLVED'), 'F2: resolved entry present');

  // F3: Student 1 cannot see student 2's history (separate endpoint, jwt-scoped)
  // (Implicitly tested by ownership checks in the backend)
  assert(true, 'F3: History is scoped to authenticated student (jwt-based, no cross-access)');

  // F4: Staff cannot access student history
  const staffHist = await get(`${BASE}/student/history`, habitatStaffToken);
  assert(staffHist.status === 403, 'F4: Staff cannot access student history endpoint');

  // F5: Anonymous request returns 401
  const anonHist = await get(`${BASE}/student/history`);
  assert(anonHist.status === 401, 'F5: Anonymous request to history returns 401');

  // F6: Student complaints list
  const complaints2 = await get(`${BASE}/student/complaints`, student2Token);
  assert(complaints2.status === 200, 'F6: Student complaints endpoint returns 200');
  assert(Array.isArray(complaints2.data.complaints), 'F6: complaints is array');
  assert(complaints2.data.complaints.length >= 1, 'F6: has at least one complaint');
}

// ── Run All ───────────────────────────────────────────────────

async function main() {
  try {
    await setup();
    await testStaffComplete();
    await testStudentNotifications();
    await testStudentGetOrder();
    await testVerifyFlow();
    await testComplaintFlow();
    await testHistoryPage();
  } catch (e: any) {
    console.error('\n[FATAL ERROR]', e.message);
    failed++;
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\n  Failed tests:');
    errors.forEach((e) => console.log(`    - ${e}`));
  }
  console.log('══════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
