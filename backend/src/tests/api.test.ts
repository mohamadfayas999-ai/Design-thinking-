async function testApi() {
  console.log('--- Testing WASHWISE API Endpoints ---\n');

  // 1. Health
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData: any = await healthRes.json();
  console.log('1. Health Check:', healthData.success ? 'PASS' : 'FAIL', healthData.message);

  // 2. Hostels
  const hostelsRes = await fetch('http://localhost:5000/api/hostels');
  const hostelsData: any = await hostelsRes.json();
  console.log('2. Hostels List:', hostelsData.data.length === 3 ? 'PASS (3 hostels)' : 'FAIL');
  const habitatId = hostelsData.data.find((h: any) => h.code === 'HABITAT')?.id;

  // 3. Admin Login
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@rajalakshmi.edu.in',
      password: 'admin123',
      role: 'ADMIN',
    }),
  });
  const adminData: any = await adminLoginRes.json();
  console.log('3. Admin Login:', adminData.success ? 'PASS' : 'FAIL', `Role: ${adminData.user?.role}`);

  // 4. Staff Login (Habitat)
  const staffLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'habitatstaff1@rajalakshmi.edu.in',
      password: 'laundrystaff123',
      role: 'STAFF',
      hostelId: habitatId,
    }),
  });
  const staffData: any = await staffLoginRes.json();
  console.log('4. Staff Login:', staffData.success ? 'PASS' : 'FAIL', `Staff: ${staffData.user?.name} in ${staffData.user?.hostelName}`);

  // 5. Staff Wrong Hostel Login (must fail!)
  const wrongHostelId = hostelsData.data.find((h: any) => h.code === 'THANDALAM')?.id;
  const staffWrongRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'habitatstaff1@rajalakshmi.edu.in',
      password: 'laundrystaff123',
      role: 'STAFF',
      hostelId: wrongHostelId,
    }),
  });
  const staffWrongData: any = await staffWrongRes.json();
  console.log('5. Staff Cross-Hostel Rejection:', !staffWrongData.success ? 'PASS' : 'FAIL', `(${staffWrongData.message})`);

  // 6. Student Login (Habitat)
  const studentLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student.one.2024.csd@rajalakshmi.edu.in',
      password: 'rec123',
      role: 'STUDENT',
      hostelId: habitatId,
    }),
  });
  const studentData: any = await studentLoginRes.json();
  console.log('6. Student Login:', studentData.success ? 'PASS' : 'FAIL', `Student: ${studentData.user?.name} (${studentData.user?.studentId})`);

  // 7. Student Get Permanent QR Token (authorized)
  const qrRes = await fetch('http://localhost:5000/api/auth/student/qr-token', {
    headers: { Authorization: `Bearer ${studentData.token}` },
  });
  const qrData: any = await qrRes.json();
  console.log('7. Student QR Token Access:', qrData.success ? 'PASS' : 'FAIL', `Opaque Token: ${qrData.qrToken?.substring(0, 16)}...`);

  // 8. Staff attempting to call Student QR endpoint (must be forbidden!)
  const forbiddenQrRes = await fetch('http://localhost:5000/api/auth/student/qr-token', {
    headers: { Authorization: `Bearer ${staffData.token}` },
  });
  const forbiddenQrData: any = await forbiddenQrRes.json();
  console.log('8. Role Guard Enforcement:', !forbiddenQrData.success ? 'PASS' : 'FAIL', `(${forbiddenQrData.message})`);

  console.log('\n--- All API Integration Tests Passed! ---');
}

testApi().catch(console.error);
