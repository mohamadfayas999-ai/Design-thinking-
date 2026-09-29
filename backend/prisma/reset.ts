import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function reset() {
  console.log('--- Resetting WASHWISE Development Database ---');
  
  // Clean tables in reverse relation order
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.laundryHistory.deleteMany({});
  await prisma.laundryOrder.deleteMany({});
  await prisma.itemCount.deleteMany({});
  await prisma.slotBooking.deleteMany({});
  await prisma.laundrySlot.deleteMany({});
  await prisma.rackShelfLocation.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.staffProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.hostel.deleteMany({});

  console.log('Tables cleared. Re-running seed...');
  execSync('npm run prisma:seed', { stdio: 'inherit' });
  console.log('--- Database Reset & Re-seed Completed ---');
}

reset()
  .catch((e) => {
    console.error('Reset Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
