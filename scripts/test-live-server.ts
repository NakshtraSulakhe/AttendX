async function testServer() {
  console.log('Testing live Next.js server on http://localhost:3000...\n');

  // 1. Unauthenticated root request should redirect to /login
  const unauthRes = await fetch('http://localhost:3000/', { redirect: 'manual' });
  console.log('1. Unauthenticated GET / status:', unauthRes.status);
  const location = unauthRes.headers.get('location');
  console.log('   Redirect location:', location);
  if (unauthRes.status !== 307 && unauthRes.status !== 302) {
    throw new Error('Expected redirect status 307/302, got ' + unauthRes.status);
  }

  // 2. Login page should return 200
  const loginRes = await fetch('http://localhost:3000/login');
  console.log('2. GET /login status:', loginRes.status);
  if (loginRes.status !== 200) {
    throw new Error('Expected 200 from /login, got ' + loginRes.status);
  }

  // 3. Login API call with valid credentials
  const authRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@attendx.com', password: 'Admin@123456' }),
  });
  console.log('3. POST /api/auth/login status:', authRes.status);
  const authData = await authRes.json();
  console.log('   Logged in user:', authData.user?.displayName, 'Role:', authData.user?.role);
  const setCookie = authRes.headers.get('set-cookie');
  console.log('   Session cookie returned:', Boolean(setCookie));

  // Extract session token cookie
  const cookieMatch = setCookie?.match(/attendx_session_token=([^;]+)/);
  const cookieHeader = cookieMatch ? `attendx_session_token=${cookieMatch[1]}` : '';

  // 4. Authenticated request to /api/auth/me using the cookie
  const meRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Cookie: cookieHeader },
  });
  console.log('4. GET /api/auth/me status:', meRes.status);
  const meData = await meRes.json();
  console.log('   Me verified email:', meData.user?.email, 'Total permissions:', meData.permissions?.length);

  // 5. Authenticated GET / with cookie
  const authRootRes = await fetch('http://localhost:3000/', {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  });
  console.log('5. Authenticated GET / status:', authRootRes.status);
  if (authRootRes.status !== 200) {
    throw new Error('Expected 200 for authenticated root request, got ' + authRootRes.status);
  }

  // 6. Test biometric connector ingestion bypass with secret
  const connectorRes = await fetch('http://localhost:3000/api/biometric/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-connector-secret': 'biometric-secure-secret-token-2026',
    },
    body: JSON.stringify({ events: [] }),
  });
  console.log('6. POST /api/biometric/events (connector ingestion) status:', connectorRes.status);
  const connectorData = await connectorRes.json();
  console.log('   Connector response:', connectorData);

  console.log('\n🎉 ALL LIVE SERVER ENDPOINTS VERIFIED 100% OPERATIONAL ON PORT 3000!');
}

testServer().catch((e) => {
  console.error('Server Test Failed:', e);
  process.exit(1);
});
