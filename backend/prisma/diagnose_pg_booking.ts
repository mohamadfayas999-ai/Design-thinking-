import { prisma } from '../src/prisma';

function parseSlotDateTime(dateStr: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 0;
  let minutes = 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (match) {
    hours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  return new Date(year, month, day, hours, minutes, 0, 0);
}

function isSlotInFuture(dateStr: string, startTimeStr: string, now: Date = new Date()): boolean {
  const slotDate = parseSlotDateTime(dateStr, startTimeStr);
  return slotDate.getTime() > now.getTime();
}

async function main() {
  const now = new Date();
  console.log('System Now:', now.toISOString());
  console.log('Local Now:', now.toString());

  // 1. Inspect PG residents and their bookings
  const pgResidents = await prisma.studentProfile.findMany({
    where: {
      user: {
        email: { in: ['user1@gmail.com', 'user2@gmail.com', 'user3@gmail.com', 'user4@gmail.com'] },
      },
    },
    include: {
      user: true,
      hostel: true,
      slotBookings: {
        include: {
          slot: true,
          laundryOrder: true,
        },
      },
    },
  });

  console.log('\n=== PG RESIDENTS & BOOKINGS ===');
  for (const r of pgResidents) {
    console.log(`Resident: ${r.user.name} (${r.user.email}) | Hostel: ${r.hostel.name} (${r.hostel.id}) | Env: ${r.user.environment}`);
    console.log(`  Total bookings in DB: ${r.slotBookings.length}`);
    for (const b of r.slotBookings) {
      console.log(`    Booking ${b.id}: status=${b.status}, date=${b.slot?.date}, time=${b.slot?.startTime}, weight=${b.weightGrams}g, batchGroup=${b.batchGroupId}, orderStatus=${b.laundryOrder?.status}`);
    }
  }

  // 2. Inspect PG Hostels & Slots
  const pgHostels = await prisma.hostel.findMany({
    where: { environment: 'PG_SHARED' },
  });

  console.log('\n=== PG HOSTELS & SLOTS ===');
  for (const h of pgHostels) {
    const allSlots = await prisma.laundrySlot.findMany({
      where: { hostelId: h.id },
      include: {
        _count: {
          select: {
            slotBookings: { where: { status: 'BOOKED' } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const dates = Array.from(new Set(allSlots.map(s => s.date)));
    const futureSlots = allSlots.filter(s => isSlotInFuture(s.date, s.startTime, now));
    const availableFutureSlots = futureSlots.filter(s => s.capacity - s._count.slotBookings > 0);

    console.log(`\nHostel: ${h.name} (${h.code})`);
    console.log(`  Total slots: ${allSlots.length}, Date range: ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} distinct dates)`);
    console.log(`  Future slots: ${futureSlots.length}`);
    console.log(`  Available future slots: ${availableFutureSlots.length}`);
    if (futureSlots.length > 0) {
      console.log(`  Next 3 future slots:`, futureSlots.slice(0, 3).map(s => `${s.date} ${s.startTime}-${s.endTime} (avail: ${s.capacity - s._count.slotBookings}/${s.capacity})`));
    } else {
      console.log(`  WARNING: NO FUTURE SLOTS for ${h.name}! Last slot date was ${dates[dates.length - 1]}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
