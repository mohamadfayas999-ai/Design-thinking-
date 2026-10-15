import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectPgResidents() {
  console.log('--- Inspecting PG_SHARED Resident Accounts ---');
  const pgUsers = await prisma.user.findMany({
    where: { environment: 'PG_SHARED', role: 'STUDENT' },
    include: {
      studentProfile: true,
      hostel: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${pgUsers.length} PG_SHARED student users:`);
  for (const u of pgUsers) {
    console.log({
      userId: u.id,
      email: u.email,
      role: u.role,
      environment: u.environment,
      hostelId: u.hostelId,
      hostelName: u.hostel?.name,
      hostelCode: u.hostel?.code,
      profileId: u.studentProfile?.id,
      studentId: u.studentProfile?.studentId,
      department: u.studentProfile?.department,
    });
  }

  console.log('\n--- Checking Target Gmail Addresses ---');
  const targetEmails = [
    'user1@gmail.com',
    'user2@gmail.com',
    'user3@gmail.com',
    'user4@gmail.com',
  ];

  const existingTargetUsers = await prisma.user.findMany({
    where: { email: { in: targetEmails } },
    select: { id: true, email: true, environment: true },
  });

  console.log(`Target Gmail accounts already existing: ${existingTargetUsers.length}`);
  for (const eu of existingTargetUsers) {
    console.log(`  Found: ${eu.email} (ID: ${eu.id}, Env: ${eu.environment})`);
  }
}

inspectPgResidents()
  .catch((e) => {
    console.error('Inspection failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
