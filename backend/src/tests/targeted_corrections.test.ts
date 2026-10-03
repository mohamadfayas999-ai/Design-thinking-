/**
 * WASHWISE — Targeted Existing-System Corrections Verification Suite
 * 
 * Verifies:
 * 1. Future slot start-time logic & backend rejection of past-start slots
 * 2. Complete cross-hostel login protection matrix (Students, Staff, Admin)
 * 3. Generic error messages (no hostel leak)
 * 4. Complaint visibility in active booking & history lifecycle
 */

import { isSlotInFuture, parseSlotDateTime } from '../utils/date.js';
import { prisma } from '../prisma.js';

const BASE = 'http://localhost:5000/api';

function assert(condition: any, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function post(url: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function get(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   WASHWISE — Targeted System Corrections Verification Suite   ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch hostels
  const hostelsRes = await get(`${BASE}/hostels`);
  const hostels = hostelsRes.data.data;
  const habitatId = hostels.find((h: any) => h.code === 'HABITAT').id;
  const thandalamId = hostels.find((h: any) => h.code === 'THANDALAM').id;
  const girlsId = hostels.find((h: any) => h.code === 'GIRLS').id;

  // ─────────────────────────────────────────────────────────────
  // 1. Future Slot Start-Time Filtering & Controlled Test Fixture
  // ─────────────────────────────────────────────────────────────
  console.log('── 1. Slot Start-Time Future-Only Logic Tests ──');
  {
    // Controlled fixture from specification:
    // Today's date with current time = 3:52 PM (15:52)
    const fixedNow = new Date(2026, 9, 2, 15, 52, 0); // 2026-10-02 15:52:00
    const todayStr = '2026-10-02';
    const tomorrowStr = '2026-10-03';

    // 2:00 PM – 3:00 PM -> start time 14:00 <= 15:52 -> MUST be hidden (false)
    const slot2pm = isSlotInFuture(todayStr, '02:00 PM', fixedNow);
    assert(!slot2pm, "Today 2:00 PM slot (start 14:00) is hidden at 3:52 PM");

    // 3:00 PM – 4:00 PM -> start time 15:00 <= 15:52 -> MUST be hidden (false)
    const slot3pm = isSlotInFuture(todayStr, '03:00 PM', fixedNow);
    assert(!slot3pm, "Today 3:00 PM slot (start 15:00) is hidden at 3:52 PM");

    // 4:00 PM – 5:00 PM -> start time 16:00 > 15:52 -> MUST be visible (true)
    const slot4pm = isSlotInFuture(todayStr, '04:00 PM', fixedNow);
    assert(slot4pm, "Today 4:00 PM slot (start 16:00) is visible at 3:52 PM");

    // Future date (tomorrow) 9:00 AM -> MUST be visible (true)
    const slotTomorrow = isSlotInFuture(tomorrowStr, '09:00 AM', fixedNow);
    assert(slotTomorrow, "Tomorrow 9:00 AM slot is visible");
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Backend Rejection of Past-Start Slots via API
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 2. Backend API Past-Slot Protection Tests ──');
  {
    // Login habitat student
    const studentLogin = await post(`${BASE}/auth/login`, {
      email: 'student.three.2024.it@rajalakshmi.edu.in',
      password: 'rec123',
      role: 'STUDENT',
      hostelId: habitatId,
    });
    assert(studentLogin.status === 200, "Student Three logged in");
    const studentToken = studentLogin.data.token;

    // Create an explicit past slot in database for Habitat
    const pastSlot = await prisma.laundrySlot.create({
      data: {
        hostelId: habitatId,
        date: '2020-01-01',
        startTime: '09:00 AM',
        endTime: '10:00 AM',
        capacity: 10,
        isActive: true,
      },
    });

    // Attempt to book this past slot via API
    const bookPastRes = await post(`${BASE}/slots/book`, {
      slotId: pastSlot.id,
      tShirtShirtCount: 2,
      pantsTrackCount: 2,
    }, studentToken);

    assert(bookPastRes.status === 400, "API rejects booking past-start slot with HTTP 400");
    assert(!bookPastRes.data.success, "API returns success=false for past slot booking");
    assert(
      bookPastRes.data.message.toLowerCase().includes('passed') ||
      bookPastRes.data.message.toLowerCase().includes('past'),
      `API error message correctly identifies past slot: "${bookPastRes.data.message}"`
    );

    // Clean up temporary slot
    await prisma.laundrySlot.delete({ where: { id: pastSlot.id } });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Cross-Hostel Login Protection & Generic Error Enforcement
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 3. Cross-Hostel Login Protection Matrix Tests ──');

  const studentAccounts = {
    HABITAT: 'student.one.2024.csd@rajalakshmi.edu.in',
    THANDALAM: 'student.four.2024.ece@rajalakshmi.edu.in',
    GIRLS: 'student.seven.2024.csd@rajalakshmi.edu.in',
  };

  const staffAccounts = {
    HABITAT: 'habitatstaff1@rajalakshmi.edu.in',
    THANDALAM: 'thandalamstaff1@rajalakshmi.edu.in',
    GIRLS: 'girlsstaff1@rajalakshmi.edu.in',
  };

  // Student Valid Logins
  for (const [hostelName, hostelIdVal, email] of [
    ['Habitat', habitatId, studentAccounts.HABITAT],
    ['Thandalam', thandalamId, studentAccounts.THANDALAM],
    ['Girls', girlsId, studentAccounts.GIRLS],
  ]) {
    const res = await post(`${BASE}/auth/login`, {
      email,
      password: 'rec123',
      role: 'STUDENT',
      hostelId: hostelIdVal,
    });
    assert(res.status === 200 && res.data.token, `Student valid login: ${hostelName} + ${hostelName} student -> SUCCESS`);
  }

  // Student Cross-Hostel Invalid Logins (Must fail with generic message, no token)
  const studentCrossCases = [
    { selectedHostel: 'Habitat', hostelId: habitatId, attempted: studentAccounts.THANDALAM },
    { selectedHostel: 'Habitat', hostelId: habitatId, attempted: studentAccounts.GIRLS },
    { selectedHostel: 'Thandalam', hostelId: thandalamId, attempted: studentAccounts.HABITAT },
    { selectedHostel: 'Thandalam', hostelId: thandalamId, attempted: studentAccounts.GIRLS },
    { selectedHostel: 'Girls', hostelId: girlsId, attempted: studentAccounts.HABITAT },
    { selectedHostel: 'Girls', hostelId: girlsId, attempted: studentAccounts.THANDALAM },
  ];

  for (const c of studentCrossCases) {
    const res = await post(`${BASE}/auth/login`, {
      email: c.attempted,
      password: 'rec123',
      role: 'STUDENT',
      hostelId: c.hostelId,
    });
    assert(res.status === 401, `Student cross-login rejected (401): ${c.selectedHostel} with ${c.attempted}`);
    assert(!res.data.token, "No token/session issued for cross-hostel login");
    assert(
      !res.data.message.toLowerCase().includes('habitat') &&
      !res.data.message.toLowerCase().includes('thandalam') &&
      !res.data.message.toLowerCase().includes('girls') &&
      !res.data.message.toLowerCase().includes('database'),
      `Generic error message does not leak hostel assignment: "${res.data.message}"`
    );
  }

  // Staff Valid Logins
  for (const [hostelName, hostelIdVal, email] of [
    ['Habitat', habitatId, staffAccounts.HABITAT],
    ['Thandalam', thandalamId, staffAccounts.THANDALAM],
    ['Girls', girlsId, staffAccounts.GIRLS],
  ]) {
    const res = await post(`${BASE}/auth/login`, {
      email,
      password: 'laundrystaff123',
      role: 'STAFF',
      hostelId: hostelIdVal,
    });
    assert(res.status === 200 && res.data.token, `Staff valid login: ${hostelName} + ${hostelName} staff -> SUCCESS`);
  }

  // Staff Cross-Hostel Invalid Logins
  const staffCrossCases = [
    { selectedHostel: 'Habitat', hostelId: habitatId, attempted: staffAccounts.THANDALAM },
    { selectedHostel: 'Habitat', hostelId: habitatId, attempted: staffAccounts.GIRLS },
    { selectedHostel: 'Thandalam', hostelId: thandalamId, attempted: staffAccounts.HABITAT },
    { selectedHostel: 'Thandalam', hostelId: thandalamId, attempted: staffAccounts.GIRLS },
    { selectedHostel: 'Girls', hostelId: girlsId, attempted: staffAccounts.HABITAT },
    { selectedHostel: 'Girls', hostelId: girlsId, attempted: staffAccounts.THANDALAM },
  ];

  for (const c of staffCrossCases) {
    const res = await post(`${BASE}/auth/login`, {
      email: c.attempted,
      password: 'laundrystaff123',
      role: 'STAFF',
      hostelId: c.hostelId,
    });
    assert(res.status === 401, `Staff cross-login rejected (401): ${c.selectedHostel} with ${c.attempted}`);
    assert(!res.data.token, "No token/session issued for cross-hostel staff login");
    assert(
      !res.data.message.toLowerCase().includes('habitat') &&
      !res.data.message.toLowerCase().includes('thandalam') &&
      !res.data.message.toLowerCase().includes('girls'),
      `Generic staff error message does not leak hostel: "${res.data.message}"`
    );
  }

  // Admin Login (no hostel selection required)
  const adminRes = await post(`${BASE}/auth/login`, {
    email: 'admin@rajalakshmi.edu.in',
    password: 'admin123',
    role: 'ADMIN',
  });
  assert(adminRes.status === 200 && adminRes.data.token, "Admin login works without hostel selection");

  // ─────────────────────────────────────────────────────────────
  // 4. Complaint Visibility in Student Dashboard Lifecycle
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 4. Complaint Visibility in Student Dashboard Lifecycle ──');
  {
    // Use Student Two in Habitat for clean complaint test
    const s2Login = await post(`${BASE}/auth/login`, {
      email: 'student.two.2024.cse@rajalakshmi.edu.in',
      password: 'rec123',
      role: 'STUDENT',
      hostelId: habitatId,
    });
    const s2Token = s2Login.data.token;

    // Check active booking for Student Two
    const activeCheck = await get(`${BASE}/slots/my-active`, s2Token);
    let orderId: string | null = null;

    if (activeCheck.data.booking?.orderStatus === 'UNDER_REVIEW') {
      console.log('  ℹ Student Two already has an order in UNDER_REVIEW status');
      assert(activeCheck.data.booking.orderStatus === 'UNDER_REVIEW', 'Active booking orderStatus is UNDER_REVIEW');
      assert(activeCheck.data.booking.complaint !== null, 'Active booking includes complaint info');
      assert(!activeCheck.data.booking.canCancel, 'Cannot cancel booking in UNDER_REVIEW status');
    } else {
      // Find complaints for student
      const complaintsRes = await get(`${BASE}/student/complaints`, s2Token);
      assert(complaintsRes.status === 200, 'Student complaints endpoint returns 200');
      assert(Array.isArray(complaintsRes.data.complaints), 'Complaints returned as array');
    }

    // Verify student history returns complaint details
    const historyRes = await get(`${BASE}/student/history`, s2Token);
    assert(historyRes.status === 200, 'Student history endpoint returns 200');
    assert(Array.isArray(historyRes.data.history), 'History is returned as array');
    const complainedItem = historyRes.data.history.find((h: any) => h.complaint !== null);
    if (complainedItem) {
      assert(complainedItem.complaint.type, `History preserves complaint type: ${complainedItem.complaint.type}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ALL TARGETED CORRECTIONS TESTS PASSED SUCCESSFULLY!         ');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
