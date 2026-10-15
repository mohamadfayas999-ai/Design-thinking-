import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Generating laundry slots until November 30, 2026...');

    const hostels = await prisma.hostel.findMany({
        where: {
            code: {
                in: ['HABITAT', 'THANDALAM', 'GIRLS'],
            },
        },
    });

    const slotTimes = [
        { start: '09:00 AM', end: '10:00 AM' },
        { start: '10:00 AM', end: '11:00 AM' },
        { start: '11:00 AM', end: '12:00 PM' },
        { start: '02:00 PM', end: '03:00 PM' },
        { start: '03:00 PM', end: '04:00 PM' },
    ];

    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const endDate = new Date(2026, 10, 30);
    endDate.setHours(12, 0, 0, 0);

    let created = 0;

    for (const hostel of hostels) {
        for (
            let date = new Date(today);
            date <= endDate;
            date.setDate(date.getDate() + 1)
        ) {
            const dateString = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, '0'),
                String(date.getDate()).padStart(2, '0'),
            ].join('-');

            const existingSlots = await prisma.laundrySlot.findMany({
                where: {
                    hostelId: hostel.id,
                    date: dateString,
                },
                select: {
                    startTime: true,
                },
            });

            const existingTimes = new Set(
                existingSlots.map((slot) => slot.startTime)
            );

            const missingSlots = slotTimes.filter(
                (time) => !existingTimes.has(time.start)
            );

            if (missingSlots.length > 0) {
                await prisma.laundrySlot.createMany({
                    data: missingSlots.map((time) => ({
                        hostelId: hostel.id,
                        date: dateString,
                        startTime: time.start,
                        endTime: time.end,
                        capacity: 10,
                        isActive: true,
                    })),
                });

                created += missingSlots.length;
            }
        }
    }

    console.log(`Successfully created ${created} new slots.`);
}

main()
    .catch((error) => {
        console.error('Slot generation failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });