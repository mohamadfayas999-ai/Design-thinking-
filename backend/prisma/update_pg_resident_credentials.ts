import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';

async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5, delayMs = 3000): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      console.warn(`[Attempt ${attempt}/${retries}] Database operation error: ${err.message || err}. Retrying in ${delayMs}ms...`);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function updatePgResidentCredentials() {
  const prisma = new PrismaClient({
    log: ['warn', 'error'],
  });

  try {
    console.log('===========================================================');
    console.log('   WASHWISE: Controlled PG Demo Resident Credentials Update');
    console.log('   (Targeted & Non-destructive: Zero change to REC records)');
    console.log('===========================================================\n');

    await executeWithRetry(async () => {
      // Baseline check: Verify all 13 live REC accounts (1 admin + 3 staff + 9 students) exist
      const recCount = await prisma.user.count({ where: { environment: 'COLLEGE' } });
      console.log(`[Safety Check] Live COLLEGE user count: ${recCount}`);
      if (recCount !== 13) {
        throw new Error(`Safety check failed: Expected 13 COLLEGE users, found ${recCount}`);
      }

      // Target mapping based on inspected PG resident IDs
      const targetMappings = [
        {
          userId: 'cmv8bi50a0008t3edl6jb1e1m',
          newEmail: 'user1@gmail.com',
          newPasswordPlain: 'user1',
          name: 'User 1',
        },
        {
          userId: 'cmv8bi7ny000dt3ed7uh2gt0h',
          newEmail: 'user2@gmail.com',
          newPasswordPlain: 'user2',
          name: 'User 2',
        },
        {
          userId: 'cmv8bi9a6000it3edr5l8e713',
          newEmail: 'user3@gmail.com',
          newPasswordPlain: 'user3',
          name: 'User 3',
        },
        {
          userId: 'cmv8bib10000nt3edmsvw69o6',
          newEmail: 'user4@gmail.com',
          newPasswordPlain: 'user4',
          name: 'User 4',
        },
      ];

      for (const mapping of targetMappings) {
        const user = await prisma.user.findUnique({
          where: { id: mapping.userId },
          include: { studentProfile: true, hostel: true },
        });

        if (!user) {
          throw new Error(`Target PG user ID ${mapping.userId} not found in database!`);
        }

        if (user.environment !== 'PG_SHARED') {
          throw new Error(`CRITICAL ABORT: User ${mapping.userId} is in environment ${user.environment}, NOT PG_SHARED!`);
        }

        // Check if new email is already used by a DIFFERENT user
        const existingWithNewEmail = await prisma.user.findUnique({
          where: { email: mapping.newEmail },
        });
        if (existingWithNewEmail && existingWithNewEmail.id !== mapping.userId) {
          throw new Error(`CRITICAL CONFLICT: Email ${mapping.newEmail} is already taken by user ${existingWithNewEmail.id}!`);
        }

        const newHash = await hashPassword(mapping.newPasswordPlain);

        // Update user: email, passwordHash
        await prisma.user.update({
          where: { id: mapping.userId },
          data: {
            email: mapping.newEmail,
            passwordHash: newHash,
          },
        });

        // Update StudentProfile name to match User 1, User 2, etc.
        if (user.studentProfile) {
          await prisma.studentProfile.update({
            where: { id: user.studentProfile.id },
            data: {
              name: mapping.name,
            },
          });
        }

        console.log(`✅ Updated PG resident [${mapping.name}]: ID ${mapping.userId} -> Email: ${mapping.newEmail} (Hostel: ${user.hostel?.name})`);
      }

      console.log('\n--- Verification of Updated PG Accounts ---');
      const updatedPgUsers = await prisma.user.findMany({
        where: { environment: 'PG_SHARED', role: 'STUDENT' },
        include: { studentProfile: true, hostel: true },
        orderBy: { email: 'asc' },
      });

      for (const u of updatedPgUsers) {
        console.log(`- ${u.studentProfile?.name}: Email = ${u.email}, Facility = ${u.hostel?.name} (${u.hostel?.code}), Roll ID = ${u.studentProfile?.studentId}, Active = ${u.isActive}`);
      }

      const postRecCount = await prisma.user.count({ where: { environment: 'COLLEGE' } });
      console.log(`\n[Post-Safety Check] Live COLLEGE user count: ${postRecCount} (Preserved: ${recCount === postRecCount})`);
    }, 5, 2000);

    console.log('\n===========================================================');
    console.log('   PG DEMO RESIDENT CREDENTIALS ACTIVATED SUCCESSFULLY');
    console.log('===========================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

updatePgResidentCredentials().catch((err) => {
  console.error('Update script failed:', err);
  process.exit(1);
});
