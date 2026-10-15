import { prisma } from '../src/prisma';
import { planSmartBatches } from '../src/services/batchPlanning.service';

async function testPlanning() {
  const users = ['user1@gmail.com', 'user2@gmail.com', 'user3@gmail.com', 'user4@gmail.com'];
  
  for (const email of users) {
    const student = await prisma.studentProfile.findFirst({
      where: { user: { email } },
      include: { user: true, hostel: true },
    });
    if (!student) {
      console.log(`Student not found for ${email}`);
      continue;
    }
    console.log(`\n======================================================`);
    console.log(`Testing planSmartBatches for ${email} (Hostel: ${student.hostel.name})`);
    
    // Test 1: Single batch (5 shirts = 1,000g)
    const plan1 = await planSmartBatches({
      studentUserId: student.userId,
      garmentCounts: { shirt: 5 },
    });
    console.log(`Test 1 (5 shirts = 1000g): status=${plan1.planningStatus}, isActionable=${plan1.isActionable}, totalBatches=${plan1.batchPlan?.totalBatches}, recommendedSlotsCount=${plan1.batchRecommendations?.[0]?.recommendedSlots?.length}`);
    if (plan1.warnings.length > 0) console.log('  Warnings:', plan1.warnings);

    // Test 2: Two batches (8 shirts + 8 pants = 5,600g)
    const plan2 = await planSmartBatches({
      studentUserId: student.userId,
      garmentCounts: { shirt: 8, pants: 8 },
    });
    console.log(`Test 2 (8 shirts + 8 pants = 5600g): status=${plan2.planningStatus}, isActionable=${plan2.isActionable}, totalBatches=${plan2.batchPlan?.totalBatches}, batchesCount=${plan2.batchPlan?.batches?.length}`);
    if (plan2.warnings.length > 0) console.log('  Warnings:', plan2.warnings);
    if (!plan2.isActionable) {
      console.log('  Why not actionable?: planningStatus=', plan2.planningStatus, 'weeklyAllowance=', plan2.weeklyAllowance);
    }
  }
}

testPlanning().catch(console.error).finally(() => prisma.$disconnect());
