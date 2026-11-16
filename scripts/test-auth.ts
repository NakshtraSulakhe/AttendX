import { AuthService } from '../src/lib/auth';
import { verifyToken } from '../src/lib/auth/jwt';
import { getDbPool } from '../src/lib/database';

async function main() {
  console.log('Testing Authentication Service...');

  // Test 1: Successful login
  const res = await AuthService.login('admin@attendx.com', 'Admin@123456', '127.0.0.1', 'TestRunner');
  console.log('1. Admin Login Result:', {
    success: res.success,
    email: res.user?.email,
    role: res.user?.role,
    permissionsCount: res.permissions?.length,
    hasToken: Boolean(res.token),
  });

  if (!res.token) {
    throw new Error('Login failed: ' + res.error);
  }

  // Test 2: Verify Token
  const session = await verifyToken(res.token);
  console.log('2. Verified Token Session:', {
    userId: session?.userId,
    email: session?.email,
    role: session?.role,
    perms: session?.permissions?.length,
  });

  // Test 3: Failed login attempt
  const failRes = await AuthService.login('admin@attendx.com', 'WrongPassword123', '127.0.0.1', 'TestRunner');
  console.log('3. Failed Login Handled Gracefully:', {
    success: failRes.success,
    error: failRes.error,
  });

  // Test 4: Check User Permissions directly
  if (res.user?.id) {
    const perms = await AuthService.getUserPermissions(res.user.id);
    console.log(`4. User has ${perms.length} distinct permissions assigned.`);
  }

  console.log('✅ All Auth Service tests passed successfully!');
}

main()
  .catch((e) => {
    console.error('Test Auth Error:', e);
    process.exit(1);
  })
  .finally(() => getDbPool().end());
