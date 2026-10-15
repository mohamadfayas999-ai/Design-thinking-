import { prisma } from '../prisma.js';
import { Role } from '../types/models.js';
import bcrypt from 'bcryptjs';

async function runFoundationTests() {
  console.log('🧪 Starting WASHWISE Phase 1 Foundation Verification Tests (COLLEGE Environment Scoped)...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Verify Hostels Count & Names for COLLEGE environment
    const hostels = await prisma.hostel.findMany({
      where: { environment: 'COLLEGE' },
    });
    assert(hostels.length === 3, 'Exactly 3 COLLEGE hostels exist (Habitat, Thandalam, Girls)');
    const hostelCodes = hostels.map((h) => h.code).sort();
    assert(
      JSON.stringify(hostelCodes) === JSON.stringify(['GIRLS', 'HABITAT', 'THANDALAM']),
      'COLLEGE hostel codes match GIRLS, HABITAT, THANDALAM'
    );

    // Test 2: Verify Total Users Count in COLLEGE environment
    const users = await prisma.user.findMany({
      where: { environment: 'COLLEGE' },
    });
    assert(users.length === 13, `Total COLLEGE users count is 13 (Found: ${users.length})`);

    // Test 3: Verify Admin User
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@rajalakshmi.edu.in' },
    });
    assert(!!admin && admin.role === Role.ADMIN && admin.environment === 'COLLEGE', 'Admin account exists with ADMIN role and COLLEGE environment');
    const adminPassMatches = admin ? await bcrypt.compare('admin123', admin.passwordHash) : false;
    assert(adminPassMatches, 'Admin password hash verifies correctly');

    // Test 4: Verify Staff Accounts (3 total, 1 per hostel in COLLEGE)
    const staff = await prisma.user.findMany({
      where: { role: Role.STAFF, environment: 'COLLEGE' },
      include: { staffProfile: true, hostel: true },
    });
    assert(staff.length === 3, 'Exactly 3 COLLEGE staff accounts exist');
    const staffHostels = new Set(staff.map((s) => s.hostel?.code));
    assert(staffHostels.size === 3, 'Each COLLEGE staff member belongs to a unique hostel');

    // Test 5: Verify Students (9 total, 3 per hostel in COLLEGE)
    const students = await prisma.user.findMany({
      where: { role: Role.STUDENT, environment: 'COLLEGE' },
      include: { studentProfile: true, hostel: true },
    });
    assert(students.length === 9, 'Exactly 9 COLLEGE student accounts exist');

    for (const code of ['HABITAT', 'THANDALAM', 'GIRLS']) {
      const hostelStudents = students.filter((s) => s.hostel?.code === code);
      assert(hostelStudents.length === 3, `COLLEGE hostel ${code} has exactly 3 students`);
    }

    // Test 6: Verify Student Names and Opaque QR Tokens for COLLEGE students
    const profiles = await prisma.studentProfile.findMany({
      where: { user: { environment: 'COLLEGE' } },
    });
    assert(profiles.length === 9, 'All 9 COLLEGE student profiles exist');
    const hasUniqueTokens = new Set(profiles.map((p) => p.permanentQrToken)).size === 9;
    assert(hasUniqueTokens, 'All 9 COLLEGE permanent QR tokens are unique');
    const hasOpaqueTokens = profiles.every((p) => p.permanentQrToken.startsWith('ww_qr_'));
    assert(hasOpaqueTokens, 'Permanent QR tokens are opaque and do not expose PII');

    // Test 7: Verify Storage and Laundry Slots exist in COLLEGE environment
    const storageLocations = await prisma.rackShelfLocation.findMany({
      where: { hostel: { environment: 'COLLEGE' } },
    });
    assert(storageLocations.length === 3 * 3 * 4, 'COLLEGE hostels have Rack 1-3 and Shelf 1-4 initialized');

    const slots = await prisma.laundrySlot.findMany({
      where: { hostel: { environment: 'COLLEGE' } },
    });
    assert(slots.length > 0, 'Initial COLLEGE laundry slots are present for testing');

    console.log(`\n=========================================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`=========================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error running foundation tests:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runFoundationTests();

