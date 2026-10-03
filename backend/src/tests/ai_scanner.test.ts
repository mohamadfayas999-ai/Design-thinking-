/**
 * WASHWISE — AI Laundry Scanner Verification Suite
 * 
 * Verifies:
 * 1. AI Recommendation Engine (deterministic rules: stain severity, detergent level)
 * 2. AI Endpoint security (Auth, Student-only role, API key concealment)
 * 3. File validation (Invalid mime, oversized image)
 * 4. AI Scan Execution & Structured Output format
 * 5. Critical Count Rule: Student booked count (8) is NEVER overwritten by AI visible estimate (7)
 * 6. Hostel Isolation for AI scan and bookings
 * 7. Staff Confirmation of descriptive observations without altering booked count
 * 8. Transparency: Original AI estimate preserved alongside Staff Confirmed values
 */

import { computeRecommendation, estimateDetergent } from '../utils/aiRules.js';
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

async function put(url: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('       WASHWISE — AI Laundry Scanner Verification Suite        ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Recommendation Engine Unit Tests
  // ─────────────────────────────────────────────────────────────
  console.log('── 1. Deterministic Recommendation Engine Rules ──');
  {
    // No stain
    const recNone = computeRecommendation({
      stainSeverity: 'None',
      visibleClothingCount: 5,
      clothingType: 'T-Shirt/Shirt',
      mainColor: 'Blue',
      possibleStain: 'None visible',
      confidence: 'High'
    });
    assert(recNone.washMode === 'Standard Wash', 'No stain -> Standard Wash');
    assert(recNone.preTreatment === 'Not normally required', 'No stain -> preTreatment not normally required');
    assert(recNone.detergentLevel === 'Low', '5 clothes -> Low detergent');

    // Low severity
    const recLow = computeRecommendation({
      stainSeverity: 'Low',
      visibleClothingCount: 8,
      clothingType: 'Pants/Track',
      mainColor: 'Black',
      possibleStain: 'Possible dirt',
      confidence: 'High'
    });
    assert(recLow.washMode === 'Standard Wash', 'Low severity -> Standard Wash');
    assert(recLow.preTreatment === 'Inspect / optional pre-treatment', 'Low severity -> Inspect / optional pre-treatment');
    assert(recLow.detergentLevel === 'Medium', '8 clothes -> Medium detergent');

    // Medium severity
    const recMed = computeRecommendation({
      stainSeverity: 'Medium',
      visibleClothingCount: 10,
      clothingType: 'T-Shirt/Shirt',
      mainColor: 'Red',
      possibleStain: 'Possible food stain',
      confidence: 'Medium'
    });
    assert(recMed.washMode === 'Standard Wash + stain attention', 'Medium severity -> Standard Wash + stain attention');
    assert(recMed.preTreatment === 'Recommended', 'Medium severity -> preTreatment Recommended');
    assert(recMed.detergentLevel === 'Medium', '10 clothes -> Medium detergent');

    // High severity
    const recHigh = computeRecommendation({
      stainSeverity: 'High',
      visibleClothingCount: 15,
      clothingType: 'T-Shirt/Shirt',
      mainColor: 'White',
      possibleStain: 'Possible oil/grease',
      confidence: 'High'
    });
    assert(recHigh.washMode === 'Careful Wash / Staff Inspection', 'High severity -> Careful Wash / Staff Inspection');
    assert(recHigh.preTreatment === 'Required before processing if appropriate', 'High severity -> Required before processing');
    assert(recHigh.detergentLevel === 'High', '15 clothes -> High detergent');

    // Unknown severity
    const recUnk = computeRecommendation({
      stainSeverity: 'Unknown',
      visibleClothingCount: 6,
      clothingType: 'UNKNOWN',
      mainColor: 'Mixed',
      possibleStain: 'Unknown',
      confidence: 'Low'
    });
    assert(recUnk.washMode === 'Standard Wash', 'Unknown severity -> Standard Wash');
    assert(recUnk.preTreatment === 'Staff inspection recommended', 'Unknown severity -> Staff inspection recommended');
  }

  // ─────────────────────────────────────────────────────────────
  // Setup Logins & Hostels
  // ─────────────────────────────────────────────────────────────
  console.log('\n── Setup Credentials & Hostels ──');
  const hostelsRes = await get(`${BASE}/hostels`);
  const hostels = hostelsRes.data.data;
  const habitat = hostels.find((h: any) => h.code === 'HABITAT');
  const thandalam = hostels.find((h: any) => h.code === 'THANDALAM');

  // Student 1 (Habitat)
  const studentHabitatRes = await post(`${BASE}/auth/login`, {
    email: 'student.one.2024.csd@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: habitat.id
  });
  assert(studentHabitatRes.status === 200, 'Student 1 logged in successfully');
  const studentToken = studentHabitatRes.data.token;

  // Student 2 (Thandalam)
  const studentThandalamRes = await post(`${BASE}/auth/login`, {
    email: 'student.four.2024.ece@rajalakshmi.edu.in',
    password: 'rec123',
    role: 'STUDENT',
    hostelId: thandalam.id
  });
  assert(studentThandalamRes.status === 200, 'Student 2 logged in successfully');
  const student2Token = studentThandalamRes.data.token;

  // Staff (Habitat)
  const staffHabitatRes = await post(`${BASE}/auth/login`, {
    email: 'habitatstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: habitat.id
  });
  assert(staffHabitatRes.status === 200, 'Staff Habitat logged in successfully');
  const staffHabitatToken = staffHabitatRes.data.token;

  // Staff (Thandalam)
  const staffThandalamRes = await post(`${BASE}/auth/login`, {
    email: 'thandalamstaff1@rajalakshmi.edu.in',
    password: 'laundrystaff123',
    role: 'STAFF',
    hostelId: thandalam.id
  });
  assert(staffThandalamRes.status === 200, 'Staff Thandalam logged in successfully');
  const staffThandalamToken = staffThandalamRes.data.token;

  // ─────────────────────────────────────────────────────────────
  // 2. AI Endpoint Security & Role Verification
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 2. AI Endpoint Security & Role Checks ──');
  {
    // Unauthenticated
    const unauth = await post(`${BASE}/student/ai-laundry-scan`, {});
    assert(unauth.status === 401, 'Unauthenticated scan rejected with 401');

    // Staff role attempting student scan
    const staffScan = await post(`${BASE}/student/ai-laundry-scan`, {}, staffHabitatToken);
    assert(staffScan.status === 403, 'Staff role rejected from student AI scan with 403');
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Validation: Format & Size
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 3. Image Validation ──');
  {
    // Missing image
    const noImg = await post(`${BASE}/student/ai-laundry-scan`, {}, studentToken);
    assert(noImg.status === 400, 'Missing image rejected with 400');

    // Invalid MIME type (e.g. text/plain or svg)
    const badMime = await post(`${BASE}/student/ai-laundry-scan`, {
      imageBase64: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }, studentToken);
    assert(badMime.status === 400, 'Unsupported image type rejected with 400');
    assert(badMime.data.message.includes('JPG, PNG, or WEBP'), 'Error message specifies supported formats');

    // Oversized image (> 5MB)
    const hugeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(7 * 1024 * 1024);
    const oversized = await post(`${BASE}/student/ai-laundry-scan`, {
      imageBase64: hugeBase64
    }, studentToken);
    assert(oversized.status === 400, 'Oversized image rejected with 400');
    assert(oversized.data.message.includes('5MB'), 'Error message specifies 5MB limit');
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Successful AI Scan Execution
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 4. AI Scan Execution & Structured Output ──');
  let scanId: string = '';
  let aiEstimate: any = null;
  {
    // 1x1 valid PNG
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const scanRes = await post(`${BASE}/student/ai-laundry-scan`, {
      imageBase64: validPng
    }, studentToken);

    assert(scanRes.status === 200, 'AI laundry scan executed successfully (200)');
    assert(scanRes.data.success === true, 'Response marked success');
    assert(typeof scanRes.data.scanId === 'string', 'Returned persistent scanId');
    assert(scanRes.data.disclaimer.includes('AI-generated estimate'), 'Contains required disclaimer');

    aiEstimate = scanRes.data.estimate;
    scanId = scanRes.data.scanId;

    assert(typeof aiEstimate.visibleClothingCount === 'number', 'Contains visibleClothingCount');
    assert(Array.isArray(aiEstimate.items), 'Contains items array');
    assert(aiEstimate.items.length > 0, 'Has at least one detected item');
    assert(aiEstimate.recommendation != null, 'Contains recommendation');
    assert(aiEstimate.recommendation.washMode != null, 'Contains washMode recommendation');
    assert(aiEstimate.recommendation.detergentLevel != null, 'Contains detergentLevel recommendation');

    // Verify API key never leaked in response
    const jsonStr = JSON.stringify(scanRes.data);
    assert(!jsonStr.toLowerCase().includes('aizasy'), 'No API key exposed in response');

    // Verify GET scan by ID
    const getScanRes = await get(`${BASE}/student/ai-laundry-scan/${scanId}`, studentToken);
    assert(getScanRes.status === 200, 'Can retrieve scan by ID');
    assert(getScanRes.data.scan.id === scanId, 'Retrieved scan ID matches');
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Critical Count Rule & Booking Integration
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 5. Critical Count Rule (Student Booked 8 vs AI Visible 7) ──');
  let bookingId: string = '';
  {
    // Clear any existing active booking and reset monthly usage for Student 1
    const student1Profile = await prisma.studentProfile.findFirst({
      where: { user: { email: 'student.one.2024.csd@rajalakshmi.edu.in' } }
    });
    if (student1Profile) {
      await prisma.slotBooking.updateMany({
        where: { studentId: student1Profile.id, status: 'BOOKED' },
        data: { status: 'CANCELLED' }
      });
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      await prisma.slotBooking.updateMany({
        where: { studentId: student1Profile.id },
        data: { createdAt: twoMonthsAgo }
      });
    }

    // Find a future available slot in Habitat or create a dedicated future slot
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const dateStr = tomorrow.toISOString().split('T')[0];

    // Create a guaranteed future slot for Habitat
    const testSlot = await prisma.laundrySlot.create({
      data: {
        hostelId: habitat.id,
        date: dateStr,
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        capacity: 10,
        isActive: true,
      }
    });

    // Student books: 5 shirts + 3 pants = 8 clothes.
    // Attaching AI scan that estimated a different count (e.g. 7 or other).
    const bookRes = await post(`${BASE}/slots/book`, {
      slotId: testSlot.id,
      tShirtShirtCount: 5,
      pantsTrackCount: 3,
      aiScanId: scanId
    }, studentToken);

    if (bookRes.status !== 201) {
      console.log('bookRes error:', bookRes);
    }
    assert(bookRes.status === 201, 'Booking created with aiScanId attached');
    bookingId = bookRes.data.booking.id;

    // Verify the booked counts on the active booking
    const verifiedActive = await get(`${BASE}/slots/my-active`, studentToken);
    const b = verifiedActive.data.booking;
    assert(b.itemCount.totalCount === 8, 'CRITICAL: Official totalClothes remains 8');
    assert(b.itemCount.tShirtShirtCount === 5, 'Official shirtCount remains 5');
    assert(b.itemCount.pantsTrackCount === 3, 'Official pantCount remains 3');
    assert(b.aiScan != null, 'aiScan is attached to the active booking');
    assert(b.aiScan.id === scanId, 'Attached aiScan ID matches');
    assert(b.aiScan.visibleClothingCount !== undefined, 'AI visible estimate is preserved separately');
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Hostel Isolation for AI Scan & Bookings
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 6. Hostel Isolation Enforcement ──');
  {
    // Student 2 (Thandalam) cannot access Student 1's AI scan
    const crossStudentScan = await get(`${BASE}/student/ai-laundry-scan/${scanId}`, student2Token);
    assert(crossStudentScan.status === 404 || crossStudentScan.status === 403, 'Cross-student cannot access other scan (404/403)');

    // Staff from Thandalam cannot confirm Habitat booking's AI scan
    const crossStaffConfirm = await put(`${BASE}/staff/bookings/${bookingId}/ai-scan-confirm`, {
      staffStainSeverity: 'Low'
    }, staffThandalamToken);
    assert(crossStaffConfirm.status === 403 || crossStaffConfirm.status === 404, 'Cross-hostel staff cannot confirm AI scan (403/404)');
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Staff Verification & Intake Confirmation
  // ─────────────────────────────────────────────────────────────
  console.log('\n── 7. Staff Verification & Intake ──');
  {
    // Habitat Staff views bookings
    const staffBookingsRes = await get(`${BASE}/staff/bookings`, staffHabitatToken);
    assert(staffBookingsRes.status === 200, 'Staff fetched bookings');
    const myBooking = staffBookingsRes.data.bookings.find((item: any) => item.id === bookingId);
    assert(myBooking != null, 'Staff sees the booking');
    assert(myBooking.aiScan != null, 'Staff sees the attached AI scan');
    assert(myBooking.aiScan.staffConfirmed === false, 'Scan initially unconfirmed by staff');

    // Staff confirms/corrects descriptive observations:
    // Staff confirms: clothing type = T-Shirt/Shirt, stain = Low, color = Blue
    const confirmRes = await put(`${BASE}/staff/bookings/${bookingId}/ai-scan-confirm`, {
      confirmedType: 'T-Shirt/Shirt',
      confirmedColor: 'Blue',
      confirmedStain: 'Possible food stain',
      confirmedSeverity: 'Low',
      confirmedRecommendation: 'Standard Wash'
    }, staffHabitatToken);

    assert(confirmRes.status === 200, 'Staff successfully confirmed/corrected AI scan');
    const updatedScan = confirmRes.data.aiScan;
    assert(updatedScan.staffConfirmed.isConfirmed === true, 'staffConfirmed is now true');
    assert(updatedScan.staffConfirmed.confirmedSeverity === 'Low', 'Staff confirmed stain severity is Low');
    assert(updatedScan.staffConfirmed.confirmedType === 'T-Shirt/Shirt', 'Staff confirmed clothing type is T-Shirt/Shirt');

    // ─────────────────────────────────────────────────────────────
    // 8. Transparency: Original AI estimate remains intact!
    // ─────────────────────────────────────────────────────────────
    console.log('\n── 8. Transparency & Auditability ──');
    assert(updatedScan.aiEstimate.visibleClothingCount != null, 'Original AI visible estimate is preserved');
    assert(updatedScan.aiEstimate.stainSeverity != null, 'Original AI stainSeverity preserved');
    assert(updatedScan.staffConfirmed.confirmedAt != null, 'Confirmation timestamp recorded');

    // Get an available rack shelf for Habitat
    const storageRes = await get(`${BASE}/staff/storage`, staffHabitatToken);
    const availableLoc = storageRes.data.storage.find((loc: any) => !loc.isOccupied);
    assert(availableLoc != null, 'Found available rack/shelf for intake');

    // Perform staff intake with physical count verification
    const intakeRes = await post(`${BASE}/staff/bookings/${bookingId}/intake`, {
      tShirtShirtCount: 5,
      pantsTrackCount: 3,
      rackShelfId: availableLoc.id,
      aiScanConfirmation: {
        confirmedType: 'T-Shirt/Shirt',
        confirmedColor: 'Blue',
        confirmedStain: 'Possible food stain',
        confirmedSeverity: 'Low',
        confirmedRecommendation: 'Standard Wash'
      }
    }, staffHabitatToken);

    assert(intakeRes.status === 200, 'Staff physical intake completed successfully');
    assert(intakeRes.data.order.status === 'IN_PROGRESS', 'Order status moved to IN_PROGRESS');

    // Verify order in database still has the 8 booked clothes and linked AI scan
    const orderInDb = await prisma.laundryOrder.findUnique({
      where: { bookingId: bookingId },
      include: { aiScan: true, itemCount: true }
    });
    assert(orderInDb != null, 'Laundry order exists in database');
    assert(orderInDb.itemCount != null, 'Order has itemCount');
    assert(orderInDb.itemCount.totalCount === 8, 'CRITICAL: Order itemCount.totalCount is exactly 8');
    assert(orderInDb.itemCount.tShirtShirtCount === 5, 'Order tShirtShirtCount is 5');
    assert(orderInDb.itemCount.pantsTrackCount === 3, 'Order pantsTrackCount is 3');
    assert(orderInDb.aiScan != null, 'Order is linked to AI scan record');
    assert(orderInDb.aiScan.staffConfirmed === true, 'Order AI scan shows staff confirmed');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   🎉 ALL AI LAUNDRY SCANNER TESTS PASSED SUCCESSFULLY!       ');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

runTests()
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
