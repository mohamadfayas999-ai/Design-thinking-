import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface VerificationResult {
  account: string;
  email: string;
  userIdMatch: boolean;
  roleMatch: boolean;
  hostelMatch: boolean;
  rollIdMatch: boolean;
  passwordHashPreserved: boolean;
  qrTokenPreserved: boolean;
  status: 'PRESERVED' | 'MISMATCH' | 'MISSING';
}

function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export async function runPreservationCheck(): Promise<boolean> {
  console.log('====================================================');
  console.log('   WASHWISE AUTOMATED ACCOUNT PRESERVATION AUDIT');
  console.log('   (Read-Only: Verifying Live REC Admin & 9 Students)');
  console.log('====================================================\n');

  const backupsDir = path.join(process.cwd(), 'prisma', 'backups');
  const jsonFiles = fs.existsSync(backupsDir)
    ? fs.readdirSync(backupsDir).filter((f) => f.endsWith('.json')).sort().reverse()
    : [];

  if (jsonFiles.length === 0) {
    throw new Error('No baseline backup found in prisma/backups for verification.');
  }

  const baseline = JSON.parse(fs.readFileSync(path.join(backupsDir, jsonFiles[0]), 'utf-8'));
  const backupUsers = new Map<string, any>(baseline.tables.User.map((u: any) => [u.email, u]));
  const backupProfiles = new Map<string, any>(
    baseline.tables.StudentProfile.map((s: any) => [s.userId, s])
  );
  const backupHostels = new Map<string, any>(baseline.tables.Hostel.map((h: any) => [h.id, h.name]));

  // 1. Expected REC Accounts
  const recAccounts = [
    { role: 'ADMIN', email: 'admin@rajalakshmi.edu.in', name: 'REC Administrator' },
    { role: 'STUDENT', email: 'student.one.2024.csd@rajalakshmi.edu.in', name: 'Student One (CSD)' },
    { role: 'STUDENT', email: 'student.two.2024.cse@rajalakshmi.edu.in', name: 'Student Two (CSE)' },
    { role: 'STUDENT', email: 'student.three.2024.it@rajalakshmi.edu.in', name: 'Student Three (IT)' },
    { role: 'STUDENT', email: 'student.four.2024.ece@rajalakshmi.edu.in', name: 'Student Four (ECE)' },
    { role: 'STUDENT', email: 'student.five.2024.mech@rajalakshmi.edu.in', name: 'Student Five (MECH)' },
    { role: 'STUDENT', email: 'student.six.2024.aids@rajalakshmi.edu.in', name: 'Student Six (AIDS)' },
    { role: 'STUDENT', email: 'student.seven.2024.csd@rajalakshmi.edu.in', name: 'Student Seven (CSD)' },
    { role: 'STUDENT', email: 'student.eight.2024.cse@rajalakshmi.edu.in', name: 'Student Eight (CSE)' },
    { role: 'STUDENT', email: 'student.nine.2024.biotech@rajalakshmi.edu.in', name: 'Student Nine (BIOTECH)' },
  ];

  const results: VerificationResult[] = [];
  let allPassed = true;

  for (const item of recAccounts) {
    const backupUser = backupUsers.get(item.email);
    if (!backupUser) {
      console.error(`Missing from baseline backup: ${item.email}`);
      allPassed = false;
      continue;
    }

    const liveUser = await prisma.user.findUnique({
      where: { email: item.email },
      include: {
        studentProfile: {
          include: { hostel: true },
        },
        hostel: true,
      },
    });

    if (!liveUser) {
      results.push({
        account: item.name,
        email: item.email,
        userIdMatch: false,
        roleMatch: false,
        hostelMatch: false,
        rollIdMatch: false,
        passwordHashPreserved: false,
        qrTokenPreserved: false,
        status: 'MISSING',
      });
      allPassed = false;
      continue;
    }

    const userIdMatch = liveUser.id === backupUser.id;
    const roleMatch = liveUser.role === backupUser.role;

    // Cryptographic hash comparison of password hashes — NEVER log the actual hash!
    const passwordHashPreserved =
      typeof liveUser.passwordHash === 'string' &&
      liveUser.passwordHash.length > 30 &&
      sha256(liveUser.passwordHash) === sha256(backupUser.passwordHash);

    let hostelMatch = true;
    let rollIdMatch = true;
    let qrTokenPreserved = true;

    if (item.role === 'STUDENT') {
      const backupProfile = backupProfiles.get(backupUser.id);
      const liveProfile = liveUser.studentProfile;

      if (!liveProfile || !backupProfile) {
        hostelMatch = false;
        rollIdMatch = false;
        qrTokenPreserved = false;
      } else {
        hostelMatch =
          liveProfile.hostelId === backupProfile.hostelId &&
          liveUser.hostelId === backupUser.hostelId;
        rollIdMatch = liveProfile.studentId === backupProfile.studentId;

        // Cryptographic hash comparison of QR tokens — NEVER log the actual token!
        qrTokenPreserved =
          typeof liveProfile.permanentQrToken === 'string' &&
          liveProfile.permanentQrToken.startsWith('ww_qr_') &&
          sha256(liveProfile.permanentQrToken) === sha256(backupProfile.permanentQrToken);
      }
    } else {
      // Admin: hostelId is null
      hostelMatch = liveUser.hostelId === backupUser.hostelId;
    }

    const isMatch =
      userIdMatch &&
      roleMatch &&
      hostelMatch &&
      rollIdMatch &&
      passwordHashPreserved &&
      qrTokenPreserved;

    if (!isMatch) allPassed = false;

    results.push({
      account: item.name,
      email: item.email,
      userIdMatch,
      roleMatch,
      hostelMatch,
      rollIdMatch,
      passwordHashPreserved,
      qrTokenPreserved,
      status: isMatch ? 'PRESERVED' : 'MISMATCH',
    });
  }

  // Format tabular output
  console.log('| Account Name              | Email Address                           | User ID | Role | Hostel | Roll ID | Pwd Hash | QR Token | Status    |');
  console.log('|:--------------------------|:----------------------------------------|:-------:|:----:|:------:|:-------:|:--------:|:--------:|:----------|');
  for (const r of results) {
    console.log(
      `| ${r.account.padEnd(25)} | ${r.email.padEnd(39)} | ${r.userIdMatch ? 'MATCH' : 'FAIL '} | ${r.roleMatch ? 'MATCH' : 'FAIL'} | ${r.hostelMatch ? 'MATCH ' : 'FAIL  '} | ${r.rollIdMatch ? 'MATCH  ' : 'N/A    '} | ${r.passwordHashPreserved ? 'VERIFIED' : 'FAILED  '} | ${r.qrTokenPreserved ? 'VERIFIED' : 'N/A     '} | ${r.status.padEnd(9)} |`
    );
  }

  console.log('\n----------------------------------------------------');
  if (allPassed) {
    console.log('✅ ALL 10 REC ACCOUNTS PERFECTLY PRESERVED & VERIFIED');
  } else {
    console.log('❌ PRESERVATION CHECK DETECTED DISCREPANCIES');
  }
  console.log('----------------------------------------------------\n');

  return allPassed;
}

if (require.main === module) {
  runPreservationCheck()
    .catch((err) => {
      console.error('Preservation check error:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
