import { PrismaClient } from '@prisma/client';
import { Role } from '../src/types/models.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateOpaqueToken(): string {
  return `ww_qr_${crypto.randomBytes(20).toString('hex')}`;
}

async function main() {
  console.log('--- Starting WASHWISE Database Seed ---');

  // 1. Create Hostels
  const hostelsData = [
    { name: 'Habitat', code: 'HABITAT', description: 'Habitat Boys Hostel' },
    { name: 'Thandalam', code: 'THANDALAM', description: 'Thandalam Boys Hostel' },
    { name: 'Girls', code: 'GIRLS', description: 'Girls Main Hostel' },
  ];

  const hostels: Record<string, any> = {};
  for (const h of hostelsData) {
    const hostel = await prisma.hostel.upsert({
      where: { code: h.code },
      update: { name: h.name, description: h.description },
      create: h,
    });
    hostels[h.code] = hostel;
    console.log(`[Hostel] Ready: ${hostel.name} (${hostel.id})`);
  }

  // 2. Passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const staffPasswordHash = await bcrypt.hash('laundrystaff123', 10);
  const studentPasswordHash = await bcrypt.hash('rec123', 10);

  // 3. Admin Account
  const adminEmail = 'admin@rajalakshmi.edu.in';
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash, role: Role.ADMIN, isActive: true },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });
  console.log(`[Admin] Seeded: ${adminUser.email}`);

  // 4. Staff Accounts (1 per hostel)
  const staffData = [
    {
      email: 'habitatstaff1@rajalakshmi.edu.in',
      name: 'Habitat Laundry Staff',
      staffId: 'STF-HAB-001',
      hostelCode: 'HABITAT',
    },
    {
      email: 'thandalamstaff1@rajalakshmi.edu.in',
      name: 'Thandalam Laundry Staff',
      staffId: 'STF-THA-001',
      hostelCode: 'THANDALAM',
    },
    {
      email: 'girlsstaff1@rajalakshmi.edu.in',
      name: 'Girls Hostel Laundry Staff',
      staffId: 'STF-GIR-001',
      hostelCode: 'GIRLS',
    },
  ];

  for (const s of staffData) {
    const hostel = hostels[s.hostelCode];
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        passwordHash: staffPasswordHash,
        role: Role.STAFF,
        hostelId: hostel.id,
        isActive: true,
      },
      create: {
        email: s.email,
        passwordHash: staffPasswordHash,
        role: Role.STAFF,
        hostelId: hostel.id,
        isActive: true,
      },
    });

    await prisma.staffProfile.upsert({
      where: { userId: user.id },
      update: {
        name: s.name,
        staffId: s.staffId,
        hostelId: hostel.id,
      },
      create: {
        userId: user.id,
        name: s.name,
        staffId: s.staffId,
        hostelId: hostel.id,
      },
    });
    console.log(`[Staff] Seeded: ${s.email} for ${hostel.name}`);
  }

  // 5. Students (3 per hostel, 9 total)
  const studentsData = [
    // Habitat
    {
      name: 'Student One',
      email: 'student.one.2024.csd@rajalakshmi.edu.in',
      studentId: '2024CSD001',
      department: 'CSD',
      admissionYear: 2024,
      hostelCode: 'HABITAT',
    },
    {
      name: 'Student Two',
      email: 'student.two.2024.cse@rajalakshmi.edu.in',
      studentId: '2024CSE002',
      department: 'CSE',
      admissionYear: 2024,
      hostelCode: 'HABITAT',
    },
    {
      name: 'Student Three',
      email: 'student.three.2024.it@rajalakshmi.edu.in',
      studentId: '2024IT003',
      department: 'IT',
      admissionYear: 2024,
      hostelCode: 'HABITAT',
    },
    // Thandalam
    {
      name: 'Student Four',
      email: 'student.four.2024.ece@rajalakshmi.edu.in',
      studentId: '2024ECE004',
      department: 'ECE',
      admissionYear: 2024,
      hostelCode: 'THANDALAM',
    },
    {
      name: 'Student Five',
      email: 'student.five.2024.mech@rajalakshmi.edu.in',
      studentId: '2024MEC005',
      department: 'MECH',
      admissionYear: 2024,
      hostelCode: 'THANDALAM',
    },
    {
      name: 'Student Six',
      email: 'student.six.2024.aids@rajalakshmi.edu.in',
      studentId: '2024ADS006',
      department: 'AIDS',
      admissionYear: 2024,
      hostelCode: 'THANDALAM',
    },
    // Girls
    {
      name: 'Student Seven',
      email: 'student.seven.2024.csd@rajalakshmi.edu.in',
      studentId: '2024CSD007',
      department: 'CSD',
      admissionYear: 2024,
      hostelCode: 'GIRLS',
    },
    {
      name: 'Student Eight',
      email: 'student.eight.2024.cse@rajalakshmi.edu.in',
      studentId: '2024CSE008',
      department: 'CSE',
      admissionYear: 2024,
      hostelCode: 'GIRLS',
    },
    {
      name: 'Student Nine',
      email: 'student.nine.2024.biotech@rajalakshmi.edu.in',
      studentId: '2024BIO009',
      department: 'BIOTECH',
      admissionYear: 2024,
      hostelCode: 'GIRLS',
    },
  ];

  for (const st of studentsData) {
    const hostel = hostels[st.hostelCode];
    const user = await prisma.user.upsert({
      where: { email: st.email },
      update: {
        passwordHash: studentPasswordHash,
        role: Role.STUDENT,
        hostelId: hostel.id,
        isActive: true,
      },
      create: {
        email: st.email,
        passwordHash: studentPasswordHash,
        role: Role.STUDENT,
        hostelId: hostel.id,
        isActive: true,
      },
    });

    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
    });

    const qrToken = existingProfile?.permanentQrToken || generateOpaqueToken();

    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        name: st.name,
        studentId: st.studentId,
        department: st.department,
        admissionYear: st.admissionYear,
        hostelId: hostel.id,
      },
      create: {
        userId: user.id,
        name: st.name,
        studentId: st.studentId,
        department: st.department,
        admissionYear: st.admissionYear,
        hostelId: hostel.id,
        permanentQrToken: qrToken,
      },
    });
    console.log(`[Student] Seeded: ${st.name} (${st.email}) in ${hostel.name}`);
  }

  // 6. Seed Rack/Shelf storage locations for each hostel (internal only)
  for (const code of ['HABITAT', 'THANDALAM', 'GIRLS']) {
    const hostel = hostels[code];
    for (let r = 1; r <= 3; r++) {
      for (let s = 1; s <= 4; s++) {
        await prisma.rackShelfLocation.upsert({
          where: {
            hostelId_rackNumber_shelfNumber: {
              hostelId: hostel.id,
              rackNumber: r,
              shelfNumber: s,
            },
          },
          update: {},
          create: {
            hostelId: hostel.id,
            rackNumber: r,
            shelfNumber: s,
            label: `Rack ${r} - Shelf ${s}`,
            isActive: true,
          },
        });
      }
    }
  }
  console.log('[Storage] Seeded Rack 1-3 & Shelf 1-4 for each hostel');

  // 7. Seed laundry slots for today + next 6 days (7 days total)
  const slotTimes = [
    { start: '09:00 AM', end: '10:00 AM' },
    { start: '10:00 AM', end: '11:00 AM' },
    { start: '11:00 AM', end: '12:00 PM' },
    { start: '02:00 PM', end: '03:00 PM' },
    { start: '03:00 PM', end: '04:00 PM' },
  ];

  const dateList: string[] = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date();
    dt.setDate(dt.getDate() + d);
    dateList.push(dt.toISOString().split('T')[0]);
  }

  for (const code of ['HABITAT', 'THANDALAM', 'GIRLS']) {
    const hostel = hostels[code];
    for (const date of dateList) {
      for (const time of slotTimes) {
        const existing = await prisma.laundrySlot.findFirst({
          where: {
            hostelId: hostel.id,
            date,
            startTime: time.start,
          },
        });
        if (!existing) {
          await prisma.laundrySlot.create({
            data: {
              hostelId: hostel.id,
              date,
              startTime: time.start,
              endTime: time.end,
              capacity: 10,
              isActive: true,
            },
          });
        }
      }
    }
  }
  console.log('[Slots] Seeded laundry slots for the next 7 days (5 slots/day per hostel)');

  console.log('--- WASHWISE Seed Completed Successfully ---');
  console.log('Total Seeded Users: 13 (1 Admin + 3 Staff + 9 Students)');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
