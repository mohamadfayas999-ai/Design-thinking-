import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function generateInsertStatements(tableName: string, rows: any[]): string {
  if (rows.length === 0) return `-- Table "${tableName}": 0 rows\n`;

  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map((col) => `"${col}"`).join(', ');

  let sql = `-- Table "${tableName}": ${rows.length} rows\n`;
  for (const row of rows) {
    const values = columns.map((col) => escapeSqlValue(row[col])).join(', ');
    sql += `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${values});\n`;
  }
  return sql + '\n';
}

async function createBackup() {
  console.log('====================================================');
  console.log('   WASHWISE PHASE 0: DATABASE BACKUP CREATION');
  console.log('====================================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'prisma', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const jsonBackupPath = path.join(backupDir, `washwise_backup_${timestamp}.json`);
  const sqlBackupPath = path.join(backupDir, `washwise_backup_${timestamp}.sql`);

  console.log('1. Querying live PostgreSQL tables...');

  // Fetch all tables in dependency order
  const [
    hostels,
    users,
    studentProfiles,
    staffProfiles,
    rackShelfLocations,
    laundrySlots,
    itemCounts,
    slotBookings,
    laundryOrders,
    notifications,
    complaints,
    laundryHistories,
    auditLogs,
    aiScans,
  ] = await Promise.all([
    prisma.hostel.findMany({ orderBy: { id: 'asc' } }),
    prisma.user.findMany({ orderBy: { id: 'asc' } }),
    prisma.studentProfile.findMany({ orderBy: { id: 'asc' } }),
    prisma.staffProfile.findMany({ orderBy: { id: 'asc' } }),
    prisma.rackShelfLocation.findMany({ orderBy: { id: 'asc' } }),
    prisma.laundrySlot.findMany({ orderBy: { id: 'asc' } }),
    prisma.itemCount.findMany({ orderBy: { id: 'asc' } }),
    prisma.slotBooking.findMany({ orderBy: { id: 'asc' } }),
    prisma.laundryOrder.findMany({ orderBy: { id: 'asc' } }),
    prisma.notification.findMany({ orderBy: { id: 'asc' } }),
    prisma.complaint.findMany({ orderBy: { id: 'asc' } }),
    prisma.laundryHistory.findMany({ orderBy: { id: 'asc' } }),
    prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
    prisma.aiScan.findMany({ orderBy: { id: 'asc' } }),
  ]);

  const recordCounts = {
    Hostel: hostels.length,
    User: users.length,
    StudentProfile: studentProfiles.length,
    StaffProfile: staffProfiles.length,
    RackShelfLocation: rackShelfLocations.length,
    LaundrySlot: laundrySlots.length,
    ItemCount: itemCounts.length,
    SlotBooking: slotBookings.length,
    LaundryOrder: laundryOrders.length,
    Notification: notifications.length,
    Complaint: complaints.length,
    LaundryHistory: laundryHistories.length,
    AuditLog: auditLogs.length,
    AiScan: aiScans.length,
  };

  console.log('   Live table counts:');
  for (const [table, count] of Object.entries(recordCounts)) {
    console.log(`   - ${table.padEnd(20)}: ${count}`);
  }

  // Verification checks on critical data
  const admin = users.find((u) => u.email === 'admin@rajalakshmi.edu.in');
  if (!admin) {
    throw new Error('FATAL: admin@rajalakshmi.edu.in not found in database!');
  }

  const students = users.filter((u) => u.role === 'STUDENT');
  if (students.length !== 9) {
    throw new Error(`FATAL: Expected 9 students, found ${students.length}`);
  }

  const qrTokens = studentProfiles.map((p) => p.permanentQrToken);
  const uniqueQrTokens = new Set(qrTokens);
  if (uniqueQrTokens.size !== 9) {
    throw new Error('FATAL: QR tokens are not unique!');
  }

  // 2. Generate JSON Snapshot
  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      sourceDatabase: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'remote-postgres',
      totalRecords: Object.values(recordCounts).reduce((a, b) => a + b, 0),
      tableCounts: recordCounts,
    },
    tables: {
      Hostel: hostels,
      User: users,
      StudentProfile: studentProfiles,
      StaffProfile: staffProfiles,
      RackShelfLocation: rackShelfLocations,
      LaundrySlot: laundrySlots,
      ItemCount: itemCounts,
      SlotBooking: slotBookings,
      LaundryOrder: laundryOrders,
      Notification: notifications,
      Complaint: complaints,
      LaundryHistory: laundryHistories,
      AuditLog: auditLogs,
      AiScan: aiScans,
    },
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const sha256 = crypto.createHash('sha256').update(jsonContent).digest('hex');
  backupData.metadata['sha256'] = sha256;

  fs.writeFileSync(jsonBackupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`\n2. Written JSON backup: ${jsonBackupPath}`);
  console.log(`   SHA-256 Checksum: ${sha256}`);

  // 3. Generate PostgreSQL-Native SQL Script
  let sqlContent = `-- ====================================================\n`;
  sqlContent += `-- WASHWISE PostgreSQL Database Backup\n`;
  sqlContent += `-- Created: ${new Date().toISOString()}\n`;
  sqlContent += `-- SHA256: ${sha256}\n`;
  sqlContent += `-- ====================================================\n\n`;
  sqlContent += `BEGIN;\n\n`;

  sqlContent += generateInsertStatements('Hostel', hostels);
  sqlContent += generateInsertStatements('User', users);
  sqlContent += generateInsertStatements('StudentProfile', studentProfiles);
  sqlContent += generateInsertStatements('StaffProfile', staffProfiles);
  sqlContent += generateInsertStatements('RackShelfLocation', rackShelfLocations);
  sqlContent += generateInsertStatements('LaundrySlot', laundrySlots);
  sqlContent += generateInsertStatements('ItemCount', itemCounts);
  sqlContent += generateInsertStatements('SlotBooking', slotBookings);
  sqlContent += generateInsertStatements('LaundryOrder', laundryOrders);
  sqlContent += generateInsertStatements('Notification', notifications);
  sqlContent += generateInsertStatements('Complaint', complaints);
  sqlContent += generateInsertStatements('LaundryHistory', laundryHistories);
  sqlContent += generateInsertStatements('AuditLog', auditLogs);
  sqlContent += generateInsertStatements('AiScan', aiScans);

  sqlContent += `COMMIT;\n`;

  fs.writeFileSync(sqlBackupPath, sqlContent, 'utf-8');
  console.log(`3. Written PostgreSQL SQL backup: ${sqlBackupPath}`);

  // 4. Verification of the written backup files
  console.log('\n4. Verifying created backup files...');
  const readBackJson = JSON.parse(fs.readFileSync(jsonBackupPath, 'utf-8'));
  if (readBackJson.tables.User.length !== 13) {
    throw new Error('Verification failed: User count mismatch in read-back JSON!');
  }
  if (readBackJson.tables.StudentProfile.length !== 9) {
    throw new Error('Verification failed: StudentProfile count mismatch in read-back JSON!');
  }
  const readBackSql = fs.readFileSync(sqlBackupPath, 'utf-8');
  if (!readBackSql.includes('INSERT INTO "User"') || !readBackSql.includes('admin@rajalakshmi.edu.in')) {
    throw new Error('Verification failed: SQL dump missing admin record!');
  }

  console.log('✅ BACKUP VERIFICATION SUCCESSFUL!');
  console.log('   - JSON Snapshot: verified');
  console.log('   - PostgreSQL SQL Dump: verified');
  console.log('   - Admin & 9 Students integrity: preserved');
  console.log('   - 9 Permanent QR Tokens: preserved');
  console.log('====================================================\n');
}

createBackup()
  .catch((err) => {
    console.error('❌ Backup Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
