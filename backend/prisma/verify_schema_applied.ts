import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyAppliedSchema() {
  console.log('=== Verifying Applied PostgreSQL Schema Objects ===\n');

  // 1. Verify Enum
  const enums: any = await prisma.$queryRaw`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'EnvironmentType'
    ORDER BY e.enumsortorder;
  `;
  console.log('1. PostgreSQL Enum `EnvironmentType` labels:');
  for (const row of enums) {
    console.log(`   - ${row.enumlabel}`);
  }

  // 2. Verify New Columns & Defaults
  const columns: any = await prisma.$queryRaw`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN (
        'environment', 'batchGroupId', 'batchNumber', 'totalBatches', 'weightGrams',
        'shirtCount', 'tshirtCount', 'pantsCount', 'jeansCount', 'shortsCount',
        'totalWeightGrams', 'unmappedReviewJson'
      )
    ORDER BY table_name, column_name;
  `;
  console.log('\n2. New Table Columns in PostgreSQL:');
  for (const c of columns) {
    console.log(`   - ${c.table_name}.${c.column_name} (type: ${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default})`);
  }

  // 3. Verify Indexes
  const indexes: any = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('Hostel_environment_idx', 'User_environment_idx', 'SlotBooking_batchGroupId_idx')
    ORDER BY tablename, indexname;
  `;
  console.log('\n3. Verified New PostgreSQL Indexes:');
  for (const idx of indexes) {
    console.log(`   - ${idx.tablename} -> ${idx.indexname}`);
  }

  // 4. Verify Existing Hostel environments
  const hostels = await prisma.hostel.findMany({
    select: { name: true, code: true, environment: true },
  });
  console.log('\n4. Live Hostels Environment Check:');
  for (const h of hostels) {
    console.log(`   - Hostel ${h.name} (${h.code}): environment = ${h.environment}`);
  }

  // 5. Verify User environments (without printing passwords/tokens)
  const users = await prisma.user.findMany({
    select: { email: true, role: true, environment: true },
  });
  console.log(`\n5. Live Users Environment Check: ${users.length} users checked`);
  const allCollege = users.every((u) => u.environment === 'COLLEGE');
  console.log(`   - All ${users.length} existing users defaulted to COLLEGE: ${allCollege ? 'YES' : 'NO'}`);

  // 6. Verify legacy ItemCount records
  const itemCounts = await prisma.itemCount.findMany();
  console.log(`\n6. ItemCount Records Check: ${itemCounts.length} records checked`);
  for (const ic of itemCounts) {
    console.log(`   - ItemCount ID ${ic.id}: legacy totalCount=${ic.totalCount}, shirtCount=${ic.shirtCount}, totalWeightGrams=${ic.totalWeightGrams}`);
  }
}

verifyAppliedSchema()
  .catch((err) => {
    console.error('Error during verification:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
