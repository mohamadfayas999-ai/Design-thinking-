import { PrismaClient, EnvironmentType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateOpaqueToken(): string {
  return `ww_qr_${crypto.randomBytes(20).toString('hex')}`;
}

export async function seedPgShared() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   WASHWISE — Phase 2B: PG & Shared Living Environment Seed    ');
  console.log('   (Additive & Idempotent: Zero modification of REC data)       ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ────────────────────────────────────────────────────────────
  // 1. Target Data Definitions
  // ────────────────────────────────────────────────────────────
  const pgFacilitiesData = [
    { name: 'Oak House', code: 'OAK_HOUSE', description: 'Oak House PG & Shared Living' },
    { name: 'Maple Villa', code: 'MAPLE_VILLA', description: 'Maple Villa PG & Shared Living' },
    { name: 'Pine Residence', code: 'PINE_RESIDENCE', description: 'Pine Residence PG & Shared Living' },
    { name: 'Cedar Suites', code: 'CEDAR_SUITES', description: 'Cedar Suites PG & Shared Living' },
  ];

  const pgAdminData = {
    email: 'admin@pgsharedliving.com',
    password: 'pgadmin123',
    role: 'ADMIN',
  };

  const pgResidentsData = [
    {
      name: 'Resident One',
      email: 'resident.one@pgsharedliving.com',
      password: 'pguser123',
      studentId: 'RES-OAK-001',
      facilityCode: 'OAK_HOUSE',
      department: 'PG Resident',
      admissionYear: 2024,
    },
    {
      name: 'Resident Two',
      email: 'resident.two@pgsharedliving.com',
      password: 'pguser123',
      studentId: 'RES-MAP-002',
      facilityCode: 'MAPLE_VILLA',
      department: 'PG Resident',
      admissionYear: 2024,
    },
    {
      name: 'Resident Three',
      email: 'resident.three@pgsharedliving.com',
      password: 'pguser123',
      studentId: 'RES-PIN-003',
      facilityCode: 'PINE_RESIDENCE',
      department: 'PG Resident',
      admissionYear: 2024,
    },
    {
      name: 'Resident Four',
      email: 'resident.four@pgsharedliving.com',
      password: 'pguser123',
      studentId: 'RES-CED-004',
      facilityCode: 'CEDAR_SUITES',
      department: 'PG Resident',
      admissionYear: 2024,
    },
  ];

  const pgSlotTimes = [
    { start: '06:00 PM', end: '07:00 PM' },
    { start: '07:00 PM', end: '08:00 PM' },
    { start: '08:00 PM', end: '09:00 PM' },
    { start: '09:00 PM', end: '10:00 PM' },
    { start: '10:00 PM', end: '11:00 PM' },
  ];

  // ────────────────────────────────────────────────────────────
  // 2. Pre-Execution Conflict & Safety Validation
  // ────────────────────────────────────────────────────────────
  console.log('[Step 1/5] Running Pre-Execution Conflict Validation...');

  // Check facility codes
  for (const fac of pgFacilitiesData) {
    const existing = await prisma.hostel.findFirst({
      where: {
        OR: [{ code: fac.code }, { name: fac.name }],
      },
    });
    if (existing && existing.environment !== EnvironmentType.PG_SHARED) {
      throw new Error(
        `Conflict detected: Facility with code ${fac.code} or name ${fac.name} already exists in environment ${existing.environment}. Aborting!`
      );
    }
  }

  // Check admin email
  const existingAdmin = await prisma.user.findUnique({
    where: { email: pgAdminData.email },
  });
  if (existingAdmin && existingAdmin.environment !== EnvironmentType.PG_SHARED) {
    throw new Error(
      `Conflict detected: User ${pgAdminData.email} already exists in environment ${existingAdmin.environment}. Aborting!`
    );
  }

  // Check resident emails and studentIds
  for (const res of pgResidentsData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: res.email },
    });
    if (existingUser && existingUser.environment !== EnvironmentType.PG_SHARED) {
      throw new Error(
        `Conflict detected: User ${res.email} already exists in environment ${existingUser.environment}. Aborting!`
      );
    }

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { studentId: res.studentId },
      include: { user: true },
    });
    if (existingProfile && existingProfile.user.environment !== EnvironmentType.PG_SHARED) {
      throw new Error(
        `Conflict detected: Resident ID ${res.studentId} already exists in environment ${existingProfile.user.environment}. Aborting!`
      );
    }
  }

  console.log('✅ Pre-execution checks passed. Zero conflicts with existing COLLEGE data.\n');

  // ────────────────────────────────────────────────────────────
  // 3. Create PG Facilities (Idempotent)
  // ────────────────────────────────────────────────────────────
  console.log('[Step 2/5] Creating PG Facilities...');
  const facilityMap: Record<string, any> = {};
  let createdFacilitiesCount = 0;

  for (const fac of pgFacilitiesData) {
    let facility = await prisma.hostel.findUnique({
      where: { code: fac.code },
    });

    if (!facility) {
      facility = await prisma.hostel.create({
        data: {
          name: fac.name,
          code: fac.code,
          description: fac.description,
          environment: EnvironmentType.PG_SHARED,
        },
      });
      createdFacilitiesCount++;
      console.log(`  + Created facility: ${facility.name} (${facility.code}) [ID: ${facility.id}]`);
    } else {
      console.log(`  = Existing facility preserved: ${facility.name} (${facility.code})`);
    }
    facilityMap[fac.code] = facility;
  }
  console.log(`Facilities processed: 4 total (${createdFacilitiesCount} newly created).\n`);

  // ────────────────────────────────────────────────────────────
  // 4. Create PG Administrator (Idempotent)
  // ────────────────────────────────────────────────────────────
  console.log('[Step 3/5] Creating PG Administrator Account...');
  let createdAdminCount = 0;
  const adminExists = await prisma.user.findUnique({
    where: { email: pgAdminData.email },
  });

  if (!adminExists) {
    const passwordHash = await bcrypt.hash(pgAdminData.password, 10);
    const newAdmin = await prisma.user.create({
      data: {
        email: pgAdminData.email,
        passwordHash,
        role: pgAdminData.role,
        environment: EnvironmentType.PG_SHARED,
        hostelId: null,
        isActive: true,
      },
    });
    createdAdminCount++;
    console.log(`  + Created PG Admin: ${newAdmin.email} [ID: ${newAdmin.id}]`);
  } else {
    console.log(`  = Existing PG Admin preserved: ${adminExists.email} (Password & fields untouched)`);
  }

  // ────────────────────────────────────────────────────────────
  // 5. Create Four PG Resident Accounts (Idempotent)
  // ────────────────────────────────────────────────────────────
  console.log('\n[Step 4/5] Creating PG Resident Accounts...');
  let createdResidentsCount = 0;

  for (const res of pgResidentsData) {
    const facility = facilityMap[res.facilityCode];
    if (!facility) {
      throw new Error(`Facility ${res.facilityCode} not found in map.`);
    }

    let user = await prisma.user.findUnique({
      where: { email: res.email },
      include: { studentProfile: true },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash(res.password, 10);
      const opaqueQrToken = generateOpaqueToken();

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: res.email,
            passwordHash,
            role: 'STUDENT',
            environment: EnvironmentType.PG_SHARED,
            hostelId: facility.id,
            isActive: true,
          },
        });

        await tx.studentProfile.create({
          data: {
            userId: newUser.id,
            name: res.name,
            studentId: res.studentId,
            department: res.department,
            admissionYear: res.admissionYear,
            hostelId: facility.id,
            permanentQrToken: opaqueQrToken,
          },
        });

        return tx.user.findUnique({
          where: { id: newUser.id },
          include: { studentProfile: true },
        }) as any;
      });

      createdResidentsCount++;
      console.log(`  + Created PG Resident: ${res.email} (${res.studentId}) in ${facility.name}`);
    } else {
      console.log(`  = Existing PG Resident preserved: ${res.email} (${res.studentId}) (Password & QR token untouched)`);
    }
  }
  console.log(`Resident accounts processed: 4 total (${createdResidentsCount} newly created).\n`);

  // ────────────────────────────────────────────────────────────
  // 6. Create PG Laundry Slots (Next 30 calendar days, Idempotent)
  // ────────────────────────────────────────────────────────────
  console.log('[Step 5/5] Creating PG Laundry Slots for Next 30 Days (5 evening slots/day)...');

  // Generate 31 calendar dates (today + next 30 days) using local calendar formatting
  const dateList: string[] = [];
  for (let d = 0; d < 31; d++) {
    const dt = new Date();
    dt.setHours(12, 0, 0, 0);
    dt.setDate(dt.getDate() + d);

    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');

    dateList.push(`${year}-${month}-${day}`);
  }

  let createdSlotsCount = 0;
  let existingSlotsCount = 0;

  for (const fac of pgFacilitiesData) {
    const facility = facilityMap[fac.code];

    for (const date of dateList) {
      for (const time of pgSlotTimes) {
        const existingSlot = await prisma.laundrySlot.findFirst({
          where: {
            hostelId: facility.id,
            date,
            startTime: time.start,
          },
        });

        if (!existingSlot) {
          await prisma.laundrySlot.create({
            data: {
              hostelId: facility.id,
              date,
              startTime: time.start,
              endTime: time.end,
              capacity: 10,
              isActive: true,
            },
          });
          createdSlotsCount++;
        } else {
          existingSlotsCount++;
        }
      }
    }
  }

  console.log(`Slots processed across 4 facilities:`);
  console.log(`  + Newly created: ${createdSlotsCount}`);
  console.log(`  = Already existing: ${existingSlotsCount}`);
  console.log(`  * Total PG slots available: ${createdSlotsCount + existingSlotsCount}\n`);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   Phase 2B PG & Shared Living Environment Seed COMPLETE!      ');
  console.log(`   - Facilities Created: ${createdFacilitiesCount}`);
  console.log(`   - Accounts Created: ${createdAdminCount + createdResidentsCount} (1 Admin + 4 Residents)`);
  console.log(`   - Slots Created: ${createdSlotsCount}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return {
    createdFacilitiesCount,
    createdAdminCount,
    createdResidentsCount,
    createdSlotsCount,
  };
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed_pg.ts') || process.argv[1]?.endsWith('seed_pg.js')) {
  seedPgShared()
    .catch((err) => {
      console.error('Fatal error during PG environment seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
