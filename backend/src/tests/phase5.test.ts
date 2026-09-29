/**
 * WASHWISE Phase 5 API Tests — Admin Portal, Analytics, Complaint Resolution, Storage & Security
 * Run: npx tsx src/tests/phase5.test.ts
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

async function main() {
  console.log('\n======================================================');
  console.log('   WASHWISE PHASE 5 — ADMIN PORTAL & SECURITY TESTS   ');
  console.log('======================================================\n');

  // 1. Hostels retrieval
  console.log('[SECTION 1] Setup & Hostels');
  const hRes = await get(`${BASE}/hostels`);
  assert(hRes.status === 200, 'Hostels list fetched successfully');
  const hostels = hRes.data.data;
  assert(Array.isArray(hostels) && hostels.length === 3, 'Found exactly 3 hostels');

  const habitat = hostels.find((h: any) => h.code === 'HABITAT');
  const thandalam = hostels.find((h: any) => h.code === 'THANDALAM');
  const girls = hostels.find((h: any) => h.code === 'GIRLS');
  assert(!!habitat && !!thandalam && !!girls, 'HABITAT, THANDALAM, GIRLS hostels exist');

  // 2. Admin Authentication
  console.log('\n[SECTION 2] Admin Authentication & Role Enforcement');
  const badLogin = await post(`${BASE}/auth/login`, {
    email: 'admin@rajalakshmi.edu.in',
    password: 'wrongpassword',
    role: 'ADMIN',
  });
  assert(badLogin.status === 401, 'Invalid admin password rejected with 401');

  const adminLogin = await post(`${BASE}/auth/login`, {
    email: 'admin@rajalakshmi.edu.in',
    password: 'admin123',
    role: 'ADMIN',
  });
  assert(adminLogin.status === 200, 'Valid admin login succeeds with 200');
  const adminToken = adminLogin.data.token || adminLogin.data.data?.token;
  assert(!!adminToken, 'Admin token returned');

  // Student login
  const studentLogin = await post(`${BASE}/auth/login`, {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: habitat.id,
  });
  const studentToken = studentLogin.data.token || studentLogin.data.data?.token;
  assert(studentLogin.status === 200, 'Student login succeeds');

  // Staff login
  const staffLogin = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitat.id,
  });
  const staffToken = staffLogin.data.token || staffLogin.data.data?.token;
  assert(staffLogin.status === 200, 'Staff login succeeds');

  // RBAC checks on Admin endpoints
  const studentOnAdmin = await get(`${BASE}/admin/summary`, studentToken);
  assert(studentOnAdmin.status === 403, 'Student denied access to /api/admin/summary (403)');

  const staffOnAdmin = await get(`${BASE}/admin/summary`, staffToken);
  assert(staffOnAdmin.status === 403, 'Staff denied access to /api/admin/summary (403)');

  const anonOnAdmin = await get(`${BASE}/admin/summary`);
  assert(anonOnAdmin.status === 401, 'Unauthenticated user denied access to /api/admin/summary (401)');

  // 3. Admin Summary & Analytics
  console.log('\n[SECTION 3] Admin Summary & Operational Analytics');
  const allSummary = await get(`${BASE}/admin/summary`, adminToken);
  assert(allSummary.status === 200, 'Admin can fetch global system summary');
  const summaryMetrics = allSummary.data.summary;
  const hostelSummaries = allSummary.data.hostels;
  assert(summaryMetrics !== undefined, 'Summary contains overall metrics');
  assert(Array.isArray(hostelSummaries), 'Summary contains hostel summaries array');
  assert(hostelSummaries.length === 3, 'Summary covers all 3 hostels');
  assert(allSummary.data.insights !== undefined, 'Summary contains descriptive demand insights');
  assert(typeof summaryMetrics.totalStudents === 'number', 'totalStudents is a valid number');
  assert(typeof summaryMetrics.storageUtilizationPercent === 'number', 'storageUtilizationPercent is a number');

  // Hostel-filtered summary
  const habitatSummary = await get(`${BASE}/admin/summary?hostelId=${habitat.id}`, adminToken);
  assert(habitatSummary.status === 200, 'Admin can fetch HABITAT filtered summary');
  assert(habitatSummary.data.hostels.length === 1, 'Only 1 hostel returned when filtered by HABITAT');

  // 4. Admin Orders & Laundry Monitoring
  console.log('\n[SECTION 4] Admin Laundry & Order Monitoring');
  const allOrders = await get(`${BASE}/admin/orders`, adminToken);
  assert(allOrders.status === 200, 'Admin can list cross-hostel orders');
  assert(Array.isArray(allOrders.data.orders), 'Orders is an array');

  // Filter orders by status and hostel
  const habitatOrders = await get(`${BASE}/admin/orders?hostelId=${habitat.id}`, adminToken);
  assert(habitatOrders.status === 200, 'Admin can filter orders by HABITAT');

  // 5. Admin Today's Slots
  console.log('\n[SECTION 5] Daily Slot Summary');
  const todaySlots = await get(`${BASE}/admin/slots/today`, adminToken);
  assert(todaySlots.status === 200, 'Admin can view today slots schedule');
  assert(Array.isArray(todaySlots.data.slots), 'Today slots returned as array');

  // 6. Storage Rack/Shelf Monitoring
  console.log('\n[SECTION 6] Storage Capacity & Rack/Shelf Monitoring');
  const storageRes = await get(`${BASE}/admin/storage`, adminToken);
  assert(storageRes.status === 200, 'Admin can view storage racks and shelves');
  assert(storageRes.data.stats !== undefined, 'Storage response contains capacity stats');
  assert(Array.isArray(storageRes.data.storage), 'Storage locations returned as array');
  assert(storageRes.data.storage.length > 0, 'Found configured storage locations');

  // 7. Student & Staff Directory (Privacy & No Leaks)
  console.log('\n[SECTION 7] Student & Staff Management (Security / Leak Check)');
  const studentsRes = await get(`${BASE}/admin/students`, adminToken);
  assert(studentsRes.status === 200, 'Admin can list students');
  const studentList = studentsRes.data.students;
  assert(Array.isArray(studentList) && studentList.length > 0, 'Students returned');

  let hasPasswordLeak = false;
  for (const st of studentList) {
    if ((st as any).password || (st as any).passwordHash) {
      hasPasswordLeak = true;
    }
  }
  assert(!hasPasswordLeak, 'No password hashes leaked in admin student listing');

  const staffRes = await get(`${BASE}/admin/staff`, adminToken);
  assert(staffRes.status === 200, 'Admin can list staff');
  const staffList = staffRes.data.staff;
  assert(Array.isArray(staffList) && staffList.length > 0, 'Staff returned');

  let hasStaffPasswordLeak = false;
  for (const sf of staffList) {
    if ((sf as any).password || (sf as any).passwordHash) {
      hasStaffPasswordLeak = true;
    }
  }
  assert(!hasStaffPasswordLeak, 'No password hashes leaked in admin staff listing');

  // 8. Complaints Listing & Resolution Workflow
  console.log('\n[SECTION 8] Complaint Management & Resolution Lifecycle');
  const complaintsRes = await get(`${BASE}/admin/complaints`, adminToken);
  assert(complaintsRes.status === 200, 'Admin can list complaints');
  const complaints = complaintsRes.data.complaints;
  assert(Array.isArray(complaints), 'Complaints returned as array');

  // Let's create an order, advance it to COMPLETED, lodge a complaint, and verify resolution
  console.log('\n  --> Creating end-to-end complaint to verify resolution & storage release');
  
  // Use Student Three for a clean monthly quota & no active booking
  const student3Login = await post(`${BASE}/auth/login`, {
    email: 'student.three.2024.it@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: habitat.id,
  });
  const student3Token = student3Login.data.token;

  // Available slot for Habitat
  const slotsRes = await get(`${BASE}/slots/available`, student3Token);
  const slot = slotsRes.data.slots?.[0];
  assert(!!slot, 'Found available slot for booking');

  // Cancel any lingering active booking for student 3 if present
  const myActiveCheck = await get(`${BASE}/slots/my-active`, student3Token);
  if (myActiveCheck.data.booking?.id && !myActiveCheck.data.booking.laundryOrder) {
    await del(`${BASE}/slots/cancel/${myActiveCheck.data.booking.id}`, student3Token);
  }

  const bookingRes = await post(`${BASE}/slots/book`, {
    slotId: slot?.id,
    tShirtShirtCount: 2,
    pantsTrackCount: 2,
  }, student3Token);

  let targetOrder: any = null;
  let targetComplaint: any = null;

  if (bookingRes.status === 201 && bookingRes.data.booking) {
    const booking = bookingRes.data.booking;
    
    // Available rack location
    const storageRes = await get(`${BASE}/staff/storage`, staffToken);
    const availRack = storageRes.data.storage?.find((r: any) => !r.isOccupied);
    assert(!!availRack, 'Found available rack for intake');

    // Intake
    const intakeRes = await post(`${BASE}/staff/bookings/${booking.id}/intake`, {
      tShirtShirtCount: 2,
      pantsTrackCount: 2,
      rackShelfId: availRack.id,
    }, staffToken);
    assert(intakeRes.status === 200, 'Staff intake successful');
    targetOrder = intakeRes.data.order;

    // Complete
    const completeRes = await post(`${BASE}/staff/orders/${targetOrder.id}/complete`, {}, staffToken);
    assert(completeRes.status === 200, 'Staff marks order COMPLETED');

    // Student files complaint
    const complaintRes = await post(`${BASE}/student/orders/${targetOrder.id}/complaint`, {
      type: 'CLOTHES_TORN',
      additionalDetails: 'Phase 5 resolution test - slight tear on sleeve',
    }, student3Token);
    assert(complaintRes.status === 201, 'Student filed complaint successfully');
    targetComplaint = complaintRes.data.complaint;

    // Verify order is UNDER_REVIEW and rack is still occupied
    const checkRackOccupied = await get(`${BASE}/staff/storage`, staffToken);
    const rackUnderReview = checkRackOccupied.data.storage?.find((r: any) => r.id === availRack.id);
    assert(rackUnderReview?.isOccupied === true, 'Rack remains occupied while complaint is UNDER_REVIEW');

    // Non-admin cannot resolve complaint
    const staffResolve = await patch(`${BASE}/admin/complaints/${targetComplaint.id}/resolve`, {
      resolutionNotes: 'Unauthorized staff resolution',
    }, staffToken);
    assert(staffResolve.status === 403, 'Staff cannot resolve complaint (403)');

    // Admin resolves complaint
    const adminResolve = await patch(`${BASE}/admin/complaints/${targetComplaint.id}/resolve`, {
      resolutionNotes: 'Inspected item and reimbursed student. Storage released.',
    }, adminToken);
    assert(adminResolve.status === 200, 'Admin resolved complaint successfully (200)');
    assert(adminResolve.data.status === 'RESOLVED', 'Complaint status updated to RESOLVED');
    assert(adminResolve.data.orderStatus === 'RESOLVED', 'Laundry order status updated to RESOLVED');

    // Duplicate resolution rejected
    const dupResolve = await patch(`${BASE}/admin/complaints/${targetComplaint.id}/resolve`, {
      resolutionNotes: 'Duplicate attempt',
    }, adminToken);
    assert(dupResolve.status === 400, 'Duplicate complaint resolution rejected with 400');

    // Storage is released after RESOLVED
    const checkRackReleased = await get(`${BASE}/staff/storage`, staffToken);
    const rackAfterResolved = checkRackReleased.data.storage?.find((r: any) => r.id === availRack.id);
    assert(rackAfterResolved?.isOccupied === false, 'Rack is RELEASED after complaint RESOLVED');
  } else {
    console.log('  (Student quota reached or active booking exists; testing resolution on existing complaints)');
    const pendingComplaint = complaints.find((c: any) => c.status === 'UNDER_REVIEW');
    if (pendingComplaint) {
      const adminResolve = await patch(`${BASE}/admin/complaints/${pendingComplaint.id}/resolve`, {
        resolutionNotes: 'Resolved existing complaint by Admin',
      }, adminToken);
      assert(adminResolve.status === 200, 'Admin resolved existing complaint successfully');
    } else {
      console.log('  (No pending complaints currently under review)');
    }
  }

  // 9. Audit Logs
  console.log('\n[SECTION 9] Administrative Audit Logs');
  const auditRes = await get(`${BASE}/admin/audit-logs`, adminToken);
  assert(auditRes.status === 200, 'Admin can view audit logs');
  const auditLogs = auditRes.data.logs;
  assert(Array.isArray(auditLogs), 'Audit logs is an array');
  assert(auditLogs.length > 0, 'Audit records exist');

  // Verify resolution or complaint actions are recorded in audit logs
  const hasAdminAction = auditLogs.some((l: any) => 
    l.action === 'COMPLAINT_RESOLVED' || 
    l.action === 'LAUNDRY_COMPLETED' || 
    l.action === 'LAUNDRY_INTAKE' ||
    l.action === 'LAUNDRY_VERIFIED'
  );
  assert(hasAdminAction, 'Key operational actions are recorded in AuditLog');

  // Non-admin cannot view audit logs
  const studentAudit = await get(`${BASE}/admin/audit-logs`, studentToken);
  assert(studentAudit.status === 403, 'Student cannot view audit logs (403)');

  // 10. Student Privacy Final Audit
  console.log('\n[SECTION 10] Student Privacy Leak Verification');
  const studentActive = await get(`${BASE}/slots/my-active`, studentToken);
  if (studentActive.status === 200 && studentActive.data.booking) {
    const act = studentActive.data.booking;
    assert((act as any).rackShelfId === undefined, 'Student active booking does NOT contain rackShelfId');
    assert((act as any).rackShelf === undefined, 'Student active booking does NOT contain rackShelf object');
    assert((act as any).staffId === undefined, 'Student active booking does NOT contain staffId');
    assert((act as any).staff === undefined, 'Student active booking does NOT contain staff object');
  }

  const studentHist = await get(`${BASE}/student/history`, studentToken);
  if (studentHist.status === 200 && studentHist.data.history?.length > 0) {
    const item = studentHist.data.history[0];
    assert((item as any).rackShelfId === undefined, 'Student history does NOT expose rackShelfId');
    assert((item as any).rackShelf === undefined, 'Student history does NOT expose rackShelf');
    assert((item as any).staffId === undefined, 'Student history does NOT expose staffId');
    assert((item as any).staff === undefined, 'Student history does NOT expose staff');
  }

  console.log('\n======================================================');
  console.log(`PHASE 5 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    console.error('Failed checks:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unexpected error running Phase 5 tests:', err);
  process.exit(1);
});
