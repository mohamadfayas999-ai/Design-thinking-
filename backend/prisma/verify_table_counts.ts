import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getTableCounts() {
  const [
    user,
    studentProfile,
    staffProfile,
    hostel,
    laundrySlot,
    slotBooking,
    itemCount,
    laundryOrder,
    rackShelfLocation,
    aiScan,
    complaint,
    laundryHistory,
    auditLog,
    notification,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.studentProfile.count(),
    prisma.staffProfile.count(),
    prisma.hostel.count(),
    prisma.laundrySlot.count(),
    prisma.slotBooking.count(),
    prisma.itemCount.count(),
    prisma.laundryOrder.count(),
    prisma.rackShelfLocation.count(),
    prisma.aiScan.count(),
    prisma.complaint.count(),
    prisma.laundryHistory.count(),
    prisma.auditLog.count(),
    prisma.notification.count(),
  ]);

  const counts: Record<string, number> = {
    User: user,
    StudentProfile: studentProfile,
    StaffProfile: staffProfile,
    Hostel: hostel,
    LaundrySlot: laundrySlot,
    SlotBooking: slotBooking,
    ItemCount: itemCount,
    LaundryOrder: laundryOrder,
    RackShelfLocation: rackShelfLocation,
    AiScan: aiScan,
    Complaint: complaint,
    LaundryHistory: laundryHistory,
    AuditLog: auditLog,
    Notification: notification,
  };

  const total = Object.values(counts).reduce((sum, val) => sum + val, 0);

  return { counts, total };
}

async function main() {
  const { counts, total } = await getTableCounts();
  console.log('--- 14-Table Record Counts Audit ---');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(20)}: ${count}`);
  }
  console.log(`  ${'TOTAL'.padEnd(20)}: ${total}`);
}

if (process.argv[1]?.endsWith('verify_table_counts.ts')) {
  main().finally(async () => {
    await prisma.$disconnect();
  });
}
