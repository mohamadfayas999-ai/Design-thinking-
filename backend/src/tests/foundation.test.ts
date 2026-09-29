import { prisma } from '../prisma.js';
import { Role } from '../types/models.js';
import bcrypt from 'bcryptjs';

async function runFoundationTests() {
  console.log('🧪 Starting WASHWISE Phase 1 Foundation Verification Tests...\n');

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
    // Test 1: Verify Hostels Count & Names
    const hostels = await prisma.hostel.findMany();
    assert(hostels.length === 3, 'Exactly 3 hostels exist (Habitat, Thandalam, Girls)');
    const hostelCodes = hostels.map((h) => h.code).sort();
    assert(
      JSON.stringify(hostelCodes) === JSON.stringify(['GIRLS', 'HABITAT', 'THANDALAM']),
      'Hostel codes match GIRLS, HABITAT, THANDALAM'
    );

    // Test 2: Verify Total Users Count
    const users = await prisma.user.findMany();
    assert(users.length === 13, `Total users count is 13 (Found: ${users.length})`);

    // Test 3: Verify Admin User
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@rajalakshmi.edu.in' },
    });
    assert(!!admin && admin.role === Role.ADMIN, 'Admin account exists with ADMIN role');
    const adminPassMatches = admin ? await bcrypt.compare('admin123', admin.passwordHash) : false;
    assert(adminPassMatches, 'Admin password hash verifies correctly');

    // Test 4: Verify Staff Accounts (3 total, 1 per hostel)
    const staff = await prisma.user.findMany({
      where: { role: Role.STAFF },
      include: { staffProfile: true, hostel: true },
    });
    assert(staff.length === 3, 'Exactly 3 staff accounts exist');
    const staffHostels = new Set(staff.map((s) => s.hostel?.code));
    assert(staffHostels.size === 3, 'Each staff member belongs to a unique hostel');

    // Test 5: Verify Students (9 total, 3 per hostel)
    const students = await prisma.user.findMany({
      where: { role: Role.STUDENT },
      include: { studentProfile: true, hostel: true },
    });
    assert(students.length === 9, 'Exactly 9 student accounts exist');

    for (const code of ['HABITAT', 'THANDALAM', 'GIRLS']) {
      const hostelStudents = students.filter((s) => s.hostel?.code === code);
      assert(hostelStudents.length === 3, `Hostel ${code} has exactly 3 students`);
    }

    // Test 6: Verify Student Names and Opaque QR Tokens
    const profiles = await prisma.studentProfile.findMany();
    assert(profiles.length === 9, 'All 9 student profiles exist');
    const hasUniqueTokens = new Set(profiles.map((p) => p.permanentQrToken)).size === 9;
    assert(hasUniqueTokens, 'All 9 permanent QR tokens are unique');
    const hasOpaqueTokens = profiles.every((p) => p.permanentQrToken.startsWith('ww_qr_'));
    assert(hasOpaqueTokens, 'Permanent QR tokens are opaque and do not expose PII');

    // Test 7: Verify Storage and Laundry Slots exist
    const storageLocations = await prisma.rackShelfLocation.findMany();
    assert(storageLocations.length === 3 * 3 * 4, 'Hostels have Rack 1-3 and Shelf 1-4 initialized');

    const slots = await prisma.laundrySlot.findMany();
    assert(slots.length > 0, 'Initial laundry slots are present for testing');

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
