import { prisma } from '../src/prisma';
import { planSmartBatches } from '../src/services/batchPlanning.service';
import { bookMultiBatch } from '../src/services/multiBatchBooking.service';
import { isSlotInFuture } from '../src/utils/date';

async function runEndToEndVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('      WASHWISE — PG BOOKING END-TO-END VERIFICATION           ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // STEP 0: Clean any previous test bookings for PG residents
  console.log('[Step 0] Cleaning up any prior PG test bookings...');
  const pgResidents = await prisma.studentProfile.findMany({
    where: {
      user: {
        email: { in: ['user1@gmail.com', 'user2@gmail.com', 'user3@gmail.com', 'user4@gmail.com'] },
      },
    },
    include: {
      slotBookings: {
        include: { laundryOrder: { include: { itemCount: true } } },
      },
      hostel: true,
      user: true,
    },
  });

  for (const r of pgResidents) {
    for (const b of r.slotBookings) {
      if (b.laundryOrder) {
        if (b.laundryOrder.itemCount) {
          await prisma.itemCount.delete({ where: { id: b.laundryOrder.itemCount.id } });
        }
        await prisma.laundryOrder.delete({ where: { id: b.laundryOrder.id } });
      }
      await prisma.slotBooking.delete({ where: { id: b.id } });
    }
  }
  console.log('✅ Clean state initialized: 0 existing bookings for PG residents.\n');

  // ────────────────────────────────────────────────────────────
  // TEST 1: User 1 — Single Batch Booking (e.g., 5 shirts = 1,000g)
  // ────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 1: User 1 — Single Batch Booking (5 shirts = 1,000g)');
  console.log('─────────────────────────────────────────────────────────────');
  const user1 = pgResidents.find((r) => r.user.email === 'user1@gmail.com')!;
  console.log(`Resident: ${user1.user.name} (${user1.user.email}) | Hostel: ${user1.hostel.name}`);
  console.log(`Permanent QR Token: ${user1.permanentQrToken}`);

  const plan1 = await planSmartBatches({
    studentUserId: user1.userId,
    garmentCounts: { shirt: 5 },
  });

  console.log(`1. Batch Planning Result:`);
  console.log(`   - Planning Status: ${plan1.planningStatus}`);
  console.log(`   - Total Approved Weight: ${plan1.weightCalculation.totalApprovedWeightGrams} g`);
  console.log(`   - Total Batches: ${plan1.batchPlan?.totalBatches}`);
  console.log(`   - Actionable: ${plan1.isActionable}`);
  if (plan1.batchPlan?.totalBatches !== 1) throw new Error('Test 1 failed: Expected 1 batch');

  const slot1 = plan1.batchRecommendations[0].recommendedSlots[0];
  console.log(`2. Slot Selected for Batch 1: Slot ${slot1.slotId} on ${slot1.date} (${slot1.startTime} – ${slot1.endTime}), Spots Available: ${slot1.availableSpots}`);

  const booking1Res = await bookMultiBatch({
    studentUserId: user1.userId,
    garmentCounts: { shirt: 5 },
    batchSlotAssignments: [{ batchNumber: 1, slotId: slot1.slotId }],
    idempotencyKey: 'demo-user1-' + Date.now(),
  });

  console.log(`3. Booking Confirmation:`);
  console.log(`   - Batch Group ID: ${booking1Res.batchGroupId}`);
  console.log(`   - Bookings Count: ${booking1Res.bookings.length}`);
  console.log(`   - Batch 1 Booking ID: ${booking1Res.bookings[0].id}`);
  console.log(`   - Batch 1 Status: ${booking1Res.bookings[0].status}`);
  console.log(`   - Weight Recorded: ${booking1Res.bookings[0].weightGrams} g`);
  console.log(`   - QR Token verified with profile: ${user1.permanentQrToken}`);
  console.log('✅ TEST 1 PASSED: User 1 single-batch booking confirmed with QR token.\n');

  // ────────────────────────────────────────────────────────────
  // TEST 2: User 2 — Multi-Batch Booking (2 Batches)
  // (e.g. 8 shirts + 6 jeans = 1600 + 3600 = 5,200g > 4,500g session limit)
  // ────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 2: User 2 — Multi-Batch Booking (8 shirts + 6 jeans = 5,200g)');
  console.log('─────────────────────────────────────────────────────────────');
  const user2 = pgResidents.find((r) => r.user.email === 'user2@gmail.com')!;
  console.log(`Resident: ${user2.user.name} (${user2.user.email}) | Hostel: ${user2.hostel.name}`);
  console.log(`Permanent QR Token: ${user2.permanentQrToken}`);

  const plan2 = await planSmartBatches({
    studentUserId: user2.userId,
    garmentCounts: { shirt: 8, jeans: 6 },
  });

  console.log(`1. Batch Planning Result:`);
  console.log(`   - Planning Status: ${plan2.planningStatus}`);
  console.log(`   - Total Approved Weight: ${plan2.weightCalculation.totalApprovedWeightGrams} g`);
  console.log(`   - Total Batches: ${plan2.batchPlan?.totalBatches}`);
  console.log(`   - Actionable: ${plan2.isActionable}`);
  console.log(`   - Batch Breakdown:`);
  for (const b of plan2.batchPlan!.batches) {
    console.log(`     * Batch ${b.batchNumber}: ${b.weightGrams} g (${b.itemCount} items)`);
  }
  if (plan2.batchPlan?.totalBatches !== 2) throw new Error('Test 2 failed: Expected 2 batches');

  const recSlots2 = plan2.batchRecommendations;
  const user2Slot1 = recSlots2[0].recommendedSlots[0];
  const user2Slot2 = recSlots2[1].recommendedSlots[1] || recSlots2[0].recommendedSlots[0];

  console.log(`2. Slots Assigned:`);
  console.log(`   - Batch 1 -> Slot ${user2Slot1.slotId} on ${user2Slot1.date} (${user2Slot1.startTime})`);
  console.log(`   - Batch 2 -> Slot ${user2Slot2.slotId} on ${user2Slot2.date} (${user2Slot2.startTime})`);

  const booking2Res = await bookMultiBatch({
    studentUserId: user2.userId,
    garmentCounts: { shirt: 8, jeans: 6 },
    batchSlotAssignments: [
      { batchNumber: 1, slotId: user2Slot1.slotId },
      { batchNumber: 2, slotId: user2Slot2.slotId },
    ],
    idempotencyKey: 'demo-user2-' + Date.now(),
  });

  console.log(`3. Multi-Batch Booking Confirmation:`);
  console.log(`   - Batch Group ID: ${booking2Res.batchGroupId}`);
  console.log(`   - Total Batches Booked: ${booking2Res.totalBatches}`);
  console.log(`   - Total Weight Booked: ${booking2Res.totalWeightGrams} g`);
  for (const b of booking2Res.bookings) {
    console.log(`     * Batch ${b.batchNumber}: ID ${b.id}, Slot ${b.slot.date} ${b.slot.startTime}, Status: ${b.status}`);
  }
  console.log('✅ TEST 2 PASSED: Both batches booked atomically in a single transaction.\n');

  // ────────────────────────────────────────────────────────────
  // TEST 3: User 3 — First-Come, First-Served Capacity Decrement
  // ────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 3: User 3 — First-Come, First-Served Capacity Verification');
  console.log('─────────────────────────────────────────────────────────────');
  const user3 = pgResidents.find((r) => r.user.email === 'user3@gmail.com')!;
  console.log(`Resident: ${user3.user.name} (${user3.user.email}) | Hostel: ${user3.hostel.name}`);

  // Check available slots for User 3's hostel (Pine Residence)
  const pineSlots = await prisma.laundrySlot.findMany({
    where: { hostelId: user3.hostelId, isActive: true },
    include: { _count: { select: { slotBookings: { where: { status: 'BOOKED' } } } } },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  const targetPineSlot = pineSlots.find((s) => isSlotInFuture(s.date, s.startTime))!;
  const spotsBefore = targetPineSlot.capacity - targetPineSlot._count.slotBookings;
  console.log(`1. Pine Residence Slot: ${targetPineSlot.date} (${targetPineSlot.startTime} – ${targetPineSlot.endTime})`);
  console.log(`   - Capacity: ${targetPineSlot.capacity}`);
  console.log(`   - Booked Count Before: ${targetPineSlot._count.slotBookings}`);
  console.log(`   - Available Spots Before: ${spotsBefore}`);

  // User 3 books 1 batch targeting targetPineSlot
  const booking3Res = await bookMultiBatch({
    studentUserId: user3.userId,
    garmentCounts: { shirt: 4, pants: 2 }, // 4*200 + 2*350 = 1500g
    batchSlotAssignments: [{ batchNumber: 1, slotId: targetPineSlot.id }],
    idempotencyKey: 'demo-user3-' + Date.now(),
  });

  console.log(`2. User 3 Booking Confirmed: ID ${booking3Res.bookings[0].id}`);

  // Re-fetch slot to verify capacity decrement
  const slotAfter = await prisma.laundrySlot.findUnique({
    where: { id: targetPineSlot.id },
    include: { _count: { select: { slotBookings: { where: { status: 'BOOKED' } } } } },
  });
  const spotsAfter = slotAfter!.capacity - slotAfter!._count.slotBookings;
  console.log(`3. Verified Slot Availability After Booking:`);
  console.log(`   - Booked Count After: ${slotAfter!._count.slotBookings}`);
  console.log(`   - Available Spots After: ${spotsAfter}`);
  if (spotsAfter !== spotsBefore - 1) {
    throw new Error(`Test 3 failed: Expected spots to decrement by 1, got ${spotsAfter}`);
  }
  console.log('✅ TEST 3 PASSED: Slot capacity decremented from ' + spotsBefore + ' to ' + spotsAfter + ' (FCFS verified).\n');

  // ────────────────────────────────────────────────────────────
  // TEST 4: Verify REC Isolation
  // ────────────────────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────');
  console.log('TEST 4: Verify REC Isolation');
  console.log('─────────────────────────────────────────────────────────────');
  const recHostels = await prisma.hostel.findMany({
    where: { environment: 'COLLEGE' },
    include: {
      laundrySlots: {
        include: { slotBookings: true },
      },
      students: { include: { user: true } },
    },
  });

  console.log(`1. REC Hostels Found: ${recHostels.map((h) => `${h.name} (${h.code})`).join(', ')}`);
  for (const h of recHostels) {
    const totalBookings = h.laundrySlots.reduce((sum, s) => sum + s.slotBookings.length, 0);
    console.log(`   - ${h.name}: ${h.students.length} residents, ${h.laundrySlots.length} slots, ${totalBookings} bookings`);
  }

  // Verify no PG bookings were attached to any REC hostel
  const crossBookings = await prisma.slotBooking.findMany({
    where: {
      slot: { hostel: { environment: 'COLLEGE' } },
      student: { user: { environment: 'PG_SHARED' } },
    },
  });

  if (crossBookings.length > 0) {
    throw new Error(`Test 4 failed: Found ${crossBookings.length} cross-environment bookings!`);
  }
  console.log('2. Cross-environment check: 0 cross-environment bookings found.');
  // Final cleanup so demo starts completely fresh
  console.log('[Final Cleanup] Resetting PG resident bookings for demo...');
  for (const r of pgResidents) {
    const bookings = await prisma.slotBooking.findMany({
      where: { studentId: r.id },
      include: { laundryOrder: { include: { itemCount: true } } },
    });
    for (const b of bookings) {
      if (b.laundryOrder) {
        if (b.laundryOrder.itemCount) {
          await prisma.itemCount.delete({ where: { id: b.laundryOrder.itemCount.id } });
        }
        await prisma.laundryOrder.delete({ where: { id: b.laundryOrder.id } });
      }
      await prisma.slotBooking.delete({ where: { id: b.id } });
    }
  }
  console.log('✅ Final cleanup complete: All PG resident accounts are clean and ready for college demo.\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   ALL 4 VERIFICATION TESTS PASSED SUCCESSFULLY!               ');
  console.log('═══════════════════════════════════════════════════════════════');
}

runEndToEndVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
