import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import assert from 'assert';
import http from 'http';
import fetch from 'node-fetch';
import { createApp } from '../app.js';
import { prisma } from '../prisma.js';

async function runLoginVerification() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  WASHWISE — PG Demo & REC Functional Authentication Audit     ');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const BASE_URL = `http://localhost:${port}/api`;

  try {
    // 1. Fetch facilities
    const oakHouse = await prisma.hostel.findUnique({ where: { code: 'OAK_HOUSE' } });
    const mapleVilla = await prisma.hostel.findUnique({ where: { code: 'MAPLE_VILLA' } });
    const pineResidence = await prisma.hostel.findUnique({ where: { code: 'PINE_RESIDENCE' } });
    const cedarSuites = await prisma.hostel.findUnique({ where: { code: 'CEDAR_SUITES' } });
    const habitat = await prisma.hostel.findUnique({ where: { code: 'HABITAT' } });

    assert(oakHouse && mapleVilla && pineResidence && cedarSuites && habitat, 'All required hostels located');

    // 2. Test User 1 login
    console.log('[Test 1] Testing User 1 (user1@gmail.com / user1)...');
    const u1Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user1@gmail.com',
        password: 'user1',
        role: 'STUDENT',
        hostelId: oakHouse.id,
      }),
    });
    const u1Data = await u1Res.json();
    assert(u1Res.status === 200, `User 1 login should return 200, got ${u1Res.status}: ${JSON.stringify(u1Data)}`);
    assert(u1Data.user.environment === 'PG_SHARED', 'User 1 environment must be PG_SHARED');
    assert(u1Data.user.email === 'user1@gmail.com', 'User 1 email matches');
    console.log('✅ User 1 login succeeded with environment PG_SHARED');

    // 3. Test User 2 login
    console.log('[Test 2] Testing User 2 (user2@gmail.com / user2)...');
    const u2Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user2@gmail.com',
        password: 'user2',
        role: 'STUDENT',
        hostelId: mapleVilla.id,
      }),
    });
    const u2Data = await u2Res.json();
    assert(u2Res.status === 200, `User 2 login should return 200`);
    assert(u2Data.user.environment === 'PG_SHARED', 'User 2 environment must be PG_SHARED');
    console.log('✅ User 2 login succeeded with environment PG_SHARED');

    // 4. Test User 3 login
    console.log('[Test 3] Testing User 3 (user3@gmail.com / user3)...');
    const u3Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user3@gmail.com',
        password: 'user3',
        role: 'STUDENT',
        hostelId: pineResidence.id,
      }),
    });
    const u3Data = await u3Res.json();
    assert(u3Res.status === 200, `User 3 login should return 200`);
    assert(u3Data.user.environment === 'PG_SHARED', 'User 3 environment must be PG_SHARED');
    console.log('✅ User 3 login succeeded with environment PG_SHARED');

    // 5. Test User 4 login
    console.log('[Test 4] Testing User 4 (user4@gmail.com / user4)...');
    const u4Res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user4@gmail.com',
        password: 'user4',
        role: 'STUDENT',
        hostelId: cedarSuites.id,
      }),
    });
    const u4Data = await u4Res.json();
    assert(u4Res.status === 200, `User 4 login should return 200`);
    assert(u4Data.user.environment === 'PG_SHARED', 'User 4 environment must be PG_SHARED');
    console.log('✅ User 4 login succeeded with environment PG_SHARED');

    // 6. Test Invalid Password for User 1
    console.log('[Test 5] Testing User 1 with Incorrect Password...');
    const badPassRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user1@gmail.com',
        password: 'wrongpassword',
        role: 'STUDENT',
        hostelId: oakHouse.id,
      }),
    });
    assert(badPassRes.status === 401, `Incorrect password must return 401, got ${badPassRes.status}`);
    console.log('✅ Incorrect password correctly rejected with HTTP 401');

    // 7. Test REC Student Login
    console.log('[Test 6] Testing REC Student 1 (student.one.2024.csd@rajalakshmi.edu.in / rec123)...');
    const recRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'student.one.2024.csd@rajalakshmi.edu.in',
        password: 'rec123',
        role: 'STUDENT',
        hostelId: habitat.id,
      }),
    });
    const recData = await recRes.json();
    assert(recRes.status === 200, `REC student login must return 200, got ${recRes.status}`);
    assert(recData.user.environment === 'COLLEGE', 'REC student environment must be COLLEGE');
    console.log('✅ REC Student login succeeded with environment COLLEGE');

    console.log('\n===========================================================');
    console.log('   ALL 6 AUTHENTICATION & SECURITY VERIFICATIONS PASSED');
    console.log('===========================================================\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runLoginVerification().catch((err) => {
  console.error('Login verification failed:', err);
  process.exit(1);
});
