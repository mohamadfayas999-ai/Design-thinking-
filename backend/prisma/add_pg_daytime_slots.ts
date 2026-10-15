import { prisma } from '../src/prisma';

async function addDaytimeSlots() {
  console.log('Adding daytime slots for PG facilities...');

  const pgHostels = await prisma.hostel.findMany({
    where: { environment: 'PG_SHARED' },
  });

  const daytimeSlots = [
    { start: '09:00 AM', end: '10:00 AM' },
    { start: '11:00 AM', end: '12:00 PM' },
    { start: '02:00 PM', end: '03:00 PM' },
    { start: '04:00 PM', end: '05:00 PM' },
  ];

  // Dates: today + next 30 days
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

  let createdCount = 0;

  for (const hostel of pgHostels) {
    for (const date of dateList) {
      for (const time of daytimeSlots) {
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
          createdCount++;
        }
      }
    }
  }

  console.log(`Successfully added ${createdCount} daytime slots across 4 PG facilities.`);
}

addDaytimeSlots().catch(console.error).finally(() => prisma.$disconnect());
