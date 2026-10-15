import { prisma } from '../src/prisma';

async function cleanupTestBookings() {
  console.log('Cleaning up PG test bookings...');
  
  // Find PG residents
  const pgResidents = await prisma.studentProfile.findMany({
    where: {
      user: {
        email: { in: ['user1@gmail.com', 'user2@gmail.com', 'user3@gmail.com', 'user4@gmail.com'] },
      },
    },
    include: {
      slotBookings: {
        include: {
          laundryOrder: {
            include: {
              itemCount: true,
            },
          },
        },
      },
    },
  });

  for (const r of pgResidents) {
    console.log(`Checking resident ${r.userId} (${r.studentId}): ${r.slotBookings.length} booking(s)`);
    for (const b of r.slotBookings) {
      console.log(`  Deleting booking ${b.id}...`);
      if (b.laundryOrder) {
        if (b.laundryOrder.itemCount) {
          await prisma.itemCount.delete({ where: { id: b.laundryOrder.itemCount.id } });
        }
        await prisma.laundryOrder.delete({ where: { id: b.laundryOrder.id } });
      }
      await prisma.slotBooking.delete({ where: { id: b.id } });
      console.log(`  Deleted booking ${b.id} and associated order.`);
    }
  }

  console.log('PG test bookings cleaned up successfully.');
}

cleanupTestBookings().catch(console.error).finally(() => prisma.$disconnect());
