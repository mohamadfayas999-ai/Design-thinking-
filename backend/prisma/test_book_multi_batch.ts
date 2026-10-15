import { prisma } from '../src/prisma';
import { planSmartBatches } from '../src/services/batchPlanning.service';
import { bookMultiBatch } from '../src/services/multiBatchBooking.service';

async function testBooking() {
  const student = await prisma.studentProfile.findFirst({
    where: { user: { email: 'user1@gmail.com' } },
    include: { user: true, hostel: true },
  });
  if (!student) throw new Error('Student user1 not found');

  console.log(`\nTesting for ${student.user.email} in ${student.hostel.name}`);

  // Test multi-batch: 8 pants + 4 jeans = 2800 + 2400 = 5200g (> 4500g, <= 7000g)
  const plan = await planSmartBatches({
    studentUserId: student.userId,
    garmentCounts: { pants: 8, jeans: 4 },
  });

  console.log(`Plan result: totalBatches=${plan.batchPlan?.totalBatches}, totalWeight=${plan.batchPlan?.totalWeightGrams}`);
  console.log(`Batches:`, plan.batchPlan?.batches.map(b => ({ num: b.batchNumber, weight: b.weightGrams, items: b.itemCount })));
  console.log(`Recommended slots for batch 1:`, plan.batchRecommendations[0]?.recommendedSlots.length);
  console.log(`Recommended slots for batch 2:`, plan.batchRecommendations[1]?.recommendedSlots.length);

  const slot1 = plan.batchRecommendations[0].recommendedSlots[0];
  const slot2 = plan.batchRecommendations[1].recommendedSlots[1] || plan.batchRecommendations[0].recommendedSlots[0];

  console.log(`Assigning Batch 1 -> Slot ${slot1.slotId} (${slot1.date} ${slot1.startTime})`);
  console.log(`Assigning Batch 2 -> Slot ${slot2.slotId} (${slot2.date} ${slot2.startTime})`);

  const idempotencyKey = 'test-multi-' + Date.now();

  try {
    const res = await bookMultiBatch({
      studentUserId: student.userId,
      garmentCounts: { pants: 8, jeans: 4 },
      batchSlotAssignments: [
        { batchNumber: 1, slotId: slot1.slotId },
        { batchNumber: 2, slotId: slot2.slotId },
      ],
      idempotencyKey,
    });
    console.log('✅ bookMultiBatch SUCCEEDED!');
    console.log('Result:', JSON.stringify(res, null, 2));

    // Clean up test booking
    await prisma.slotBooking.deleteMany({
      where: { batchGroupId: idempotencyKey },
    });
    console.log('Cleaned up test booking.');
  } catch (err: any) {
    console.error('❌ bookMultiBatch FAILED:', err);
  }
}

testBooking().catch(console.error).finally(() => prisma.$disconnect());
