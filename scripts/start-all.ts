import { spawn } from 'child_process';
import path from 'path';

console.log('====================================================');
console.log('   STARTING BIOMETRIC ATTENDANCE SYSTEM (ALL)      ');
console.log('   - Next.js Web Application on Port 3001          ');
console.log('   - Hikvision Biometric Connector Daemon          ');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Start Next.js App
const nextProcess = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

// 2. Start Connector Daemon
const connectorProcess = spawn(npmCmd, ['run', 'connector'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

const cleanup = () => {
  console.log('\nShutting down all biometric processes...');
  try {
    nextProcess.kill('SIGTERM');
    connectorProcess.kill('SIGTERM');
  } catch {
    // Ignore
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

