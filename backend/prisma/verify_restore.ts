import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { PrismaClient } from '@prisma/client';

const livePrisma = new PrismaClient();

async function runRestoreVerification() {
  console.log('====================================================');
  console.log('   WASHWISE PHASE 0: RESTORATION VERIFICATION TEST');
  console.log('   (Target: Isolated Temporary Database ONLY)');
  console.log('====================================================\n');

  const backupsDir = path.join(process.cwd(), 'prisma', 'backups');
  if (!fs.existsSync(backupsDir)) {
    throw new Error('No backups directory found!');
  }

  // Find latest JSON and SQL backup files
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error('No JSON backup found in prisma/backups!');
  }
  files.sort().reverse();
  const latestBackupPath = path.join(backupsDir, files[0]);
  console.log(`1. Loading backup archive: ${latestBackupPath}`);

  const backupData = JSON.parse(fs.readFileSync(latestBackupPath, 'utf-8'));
  const { metadata, tables } = backupData;

  console.log(`   - Timestamp: ${metadata.timestamp}`);
  console.log(`   - Recorded Total Records: ${metadata.totalRecords}`);

  // Path to the isolated temporary database
  const tempDbPath = path.join(backupsDir, 'temp_isolated_verification.db');
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }

  console.log(`\n2. Initializing separate temporary database: ${tempDbPath}`);
  const tempDb = new DatabaseSync(tempDbPath);

  // Enable foreign keys in temporary SQLite db
  tempDb.exec('PRAGMA foreign_keys = ON;');

  console.log('3. Creating schema tables in temporary database...');

  // Create tables matching schema
  tempDb.exec(`
    CREATE TABLE "Hostel" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "code" TEXT UNIQUE NOT NULL,
      "description" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE "User" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT UNIQUE NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "hostelId" TEXT,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
    );

    CREATE TABLE "StudentProfile" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT UNIQUE NOT NULL,
      "studentId" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "department" TEXT NOT NULL,
      "admissionYear" INTEGER NOT NULL,
      "hostelId" TEXT NOT NULL,
      "permanentQrToken" TEXT UNIQUE NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id"),
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
    );

    CREATE TABLE "StaffProfile" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT UNIQUE NOT NULL,
      "staffId" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "hostelId" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id"),
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
    );

    CREATE TABLE "LaundrySlot" (
      "id" TEXT PRIMARY KEY,
      "hostelId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "startTime" TEXT NOT NULL,
      "endTime" TEXT NOT NULL,
      "capacity" INTEGER NOT NULL DEFAULT 10,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
    );

    CREATE TABLE "ItemCount" (
      "id" TEXT PRIMARY KEY,
      "tShirtShirtCount" INTEGER NOT NULL DEFAULT 0,
      "pantsTrackCount" INTEGER NOT NULL DEFAULT 0,
      "totalCount" INTEGER NOT NULL DEFAULT 0,
      "isLocked" INTEGER NOT NULL DEFAULT 0,
      "lockedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );

    CREATE TABLE "RackShelfLocation" (
      "id" TEXT PRIMARY KEY,
      "hostelId" TEXT NOT NULL,
      "rackNumber" INTEGER NOT NULL,
      "shelfNumber" INTEGER NOT NULL,
      "label" TEXT NOT NULL,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id")
    );

    CREATE TABLE "SlotBooking" (
      "id" TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      "slotId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'BOOKED',
      "bookedAt" TEXT NOT NULL,
      "cancelledAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id"),
      FOREIGN KEY ("slotId") REFERENCES "LaundrySlot"("id")
    );

    CREATE TABLE "LaundryOrder" (
      "id" TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      "bookingId" TEXT UNIQUE NOT NULL,
      "hostelId" TEXT NOT NULL,
      "staffId" TEXT,
      "rackShelfId" TEXT,
      "itemCountId" TEXT UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'BOOKED',
      "submittedAt" TEXT,
      "startedAt" TEXT,
      "completedAt" TEXT,
      "verifiedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id"),
      FOREIGN KEY ("bookingId") REFERENCES "SlotBooking"("id"),
      FOREIGN KEY ("hostelId") REFERENCES "Hostel"("id"),
      FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id"),
      FOREIGN KEY ("rackShelfId") REFERENCES "RackShelfLocation"("id"),
      FOREIGN KEY ("itemCountId") REFERENCES "ItemCount"("id")
    );

    CREATE TABLE "Notification" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'LAUNDRY_COMPLETED',
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "isRead" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id")
    );

    CREATE TABLE "Complaint" (
      "id" TEXT PRIMARY KEY,
      "laundryOrderId" TEXT UNIQUE NOT NULL,
      "studentId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "additionalDetails" TEXT,
      "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
      "createdAt" TEXT NOT NULL,
      "resolvedAt" TEXT,
      FOREIGN KEY ("laundryOrderId") REFERENCES "LaundryOrder"("id"),
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id")
    );

    CREATE TABLE "LaundryHistory" (
      "id" TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      "laundryOrderId" TEXT,
      "bookingDate" TEXT NOT NULL,
      "slotTiming" TEXT NOT NULL,
      "clothesCount" INTEGER NOT NULL,
      "processStartedAt" TEXT,
      "completedAt" TEXT,
      "finalOutcome" TEXT NOT NULL,
      "complaintType" TEXT,
      "complaintDetails" TEXT,
      "complaintStatus" TEXT,
      "resolvedAt" TEXT,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id"),
      FOREIGN KEY ("laundryOrderId") REFERENCES "LaundryOrder"("id")
    );

    CREATE TABLE "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "actorUserId" TEXT,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "oldValue" TEXT,
      "newValue" TEXT,
      "reason" TEXT,
      "createdAt" TEXT NOT NULL,
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    );

    CREATE TABLE "AiScan" (
      "id" TEXT PRIMARY KEY,
      "studentId" TEXT NOT NULL,
      "hostelId" TEXT NOT NULL,
      "bookingId" TEXT UNIQUE,
      "laundryOrderId" TEXT UNIQUE,
      "visibleClothingCount" INTEGER NOT NULL,
      "clothingType" TEXT NOT NULL,
      "mainColor" TEXT NOT NULL,
      "possibleStain" TEXT NOT NULL,
      "stainSeverity" TEXT NOT NULL,
      "confidence" TEXT NOT NULL DEFAULT 'Medium',
      "itemsJson" TEXT,
      "washMode" TEXT NOT NULL,
      "preTreatment" TEXT NOT NULL,
      "detergentLevel" TEXT NOT NULL,
      "staffConfirmed" INTEGER NOT NULL DEFAULT 0,
      "confirmedType" TEXT,
      "confirmedColor" TEXT,
      "confirmedStain" TEXT,
      "confirmedSeverity" TEXT,
      "confirmedWashMode" TEXT,
      "confirmedPreTreatment" TEXT,
      "confirmedRecommendation" TEXT,
      "confirmedAt" TEXT,
      "confirmedByStaffId" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      FOREIGN KEY ("bookingId") REFERENCES "SlotBooking"("id"),
      FOREIGN KEY ("laundryOrderId") REFERENCES "LaundryOrder"("id")
    );
  `);

  console.log('4. Restoring data into temporary database...');

  // Helper to insert rows into temporary database
  function restoreTable(tableName: string, rows: any[]) {
    if (rows.length === 0) return;
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const stmt = tempDb.prepare(`INSERT INTO "${tableName}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

    for (const r of rows) {
      const vals = cols.map((col) => {
        const val = r[col];
        if (val === null || val === undefined) return null;
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
      });
      stmt.run(...vals);
    }
  }

  // Restore in dependency order
  restoreTable('Hostel', tables.Hostel);
  restoreTable('User', tables.User);
  restoreTable('StudentProfile', tables.StudentProfile);
  restoreTable('StaffProfile', tables.StaffProfile);
  restoreTable('RackShelfLocation', tables.RackShelfLocation);
  restoreTable('LaundrySlot', tables.LaundrySlot);
  restoreTable('ItemCount', tables.ItemCount);
  restoreTable('SlotBooking', tables.SlotBooking);
  restoreTable('LaundryOrder', tables.LaundryOrder);
  restoreTable('Notification', tables.Notification);
  restoreTable('Complaint', tables.Complaint);
  restoreTable('LaundryHistory', tables.LaundryHistory);
  restoreTable('AuditLog', tables.AuditLog);
  restoreTable('AiScan', tables.AiScan);

  console.log('5. Validating restoration accuracy against temporary database...');

  // Verify counts
  for (const [table, expectedCount] of Object.entries(metadata.tableCounts)) {
    const row = tempDb.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).get() as { cnt: number };
    if (row.cnt !== expectedCount) {
      throw new Error(`Count mismatch in restored table "${table}": expected ${expectedCount}, got ${row.cnt}`);
    }
    console.log(`   ✓ Restored "${table}": ${row.cnt} rows verified`);
  }

  // Verify critical REC accounts
  const restoredAdmin = tempDb.prepare(`SELECT * FROM "User" WHERE email = ?`).get('admin@rajalakshmi.edu.in') as any;
  if (!restoredAdmin || restoredAdmin.role !== 'ADMIN') {
    throw new Error('Restoration verification failed: Admin account missing or corrupted!');
  }
  console.log(`   ✓ Restored Admin: ${restoredAdmin.email} verified`);

  const restoredStudents = tempDb.prepare(`SELECT COUNT(*) as cnt FROM "User" WHERE role = 'STUDENT'`).get() as { cnt: number };
  if (restoredStudents.cnt !== 9) {
    throw new Error(`Restoration verification failed: Expected 9 students, got ${restoredStudents.cnt}`);
  }
  console.log(`   ✓ Restored 9 Students: verified`);

  const qrTokensCount = tempDb.prepare(`SELECT COUNT(DISTINCT permanentQrToken) as cnt FROM "StudentProfile"`).get() as { cnt: number };
  if (qrTokensCount.cnt !== 9) {
    throw new Error('Restoration verification failed: QR tokens missing or duplicated!');
  }
  console.log(`   ✓ Restored 9 Distinct Permanent QR Tokens: verified`);

  // Foreign key integrity check
  const fkCheck = tempDb.prepare(`PRAGMA foreign_key_check;`).all();
  if (fkCheck.length > 0) {
    throw new Error(`Foreign key check failed in restored database: ${JSON.stringify(fkCheck)}`);
  }
  console.log(`   ✓ Foreign Key Integrity Check: PASSED (0 violations)`);

  // 6. Confirm Live PostgreSQL DB Was Not Affected
  console.log('\n6. Confirming Live PostgreSQL Database integrity...');
  const liveUserCount = await livePrisma.user.count();
  if (liveUserCount !== metadata.tableCounts.User) {
    throw new Error('FATAL: Live database row count changed during test!');
  }
  console.log(`   ✓ Live PostgreSQL User Count unchanged: ${liveUserCount}`);

  // Cleanup temporary database file
  tempDb.close();
  if (fs.existsSync(tempDbPath)) {
    fs.unlinkSync(tempDbPath);
  }
  console.log(`   ✓ Temporary test database cleaned up: ${tempDbPath}`);

  console.log('\n====================================================');
  console.log('✅ ALL PHASE 0 RESTORATION TESTS PASSED!');
  console.log('   - Backup files verified and recoverable');
  console.log('   - Restoration tested successfully in isolated db');
  console.log('   - Zero writes made to live database');
  console.log('====================================================\n');
}

runRestoreVerification()
  .catch((e) => {
    console.error('❌ Restoration Verification Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await livePrisma.$disconnect();
  });
