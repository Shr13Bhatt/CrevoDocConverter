const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('[Setup] Initializing Python Environment Setup...');

const rootDir = path.join(__dirname, '..');
const venvDir = path.join(rootDir, '.venv');
const isWin = process.platform === 'win32';
const venvPython = isWin ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python');
const venvPip = isWin ? path.join(venvDir, 'Scripts', 'pip.exe') : path.join(venvDir, 'bin', 'pip');
const sysPy = isWin ? 'python' : 'python3';

try {
  if (!fs.existsSync(venvPython)) {
    console.log(`[Setup] Creating Python virtual environment at .venv using ${sysPy}...`);
    execSync(`"${sysPy}" -m venv .venv`, { stdio: 'inherit', cwd: rootDir });
  }

  if (fs.existsSync(venvPip)) {
    console.log('[Setup] Installing requirements.txt into .venv...');
    execSync(`"${venvPip}" install -r requirements.txt`, { stdio: 'inherit', cwd: rootDir });
    console.log('[Setup] Python virtual environment ready at .venv!');
  } else {
    console.log('[Setup] Virtualenv pip not found, falling back to system pip install...');
    execSync(`"${sysPy}" -m pip install -r requirements.txt`, { stdio: 'inherit', cwd: rootDir });
  }
} catch (err) {
  console.error('[Setup Warning] Virtualenv creation failed, running user pip fallback:', err.message);
  try {
    execSync(`"${sysPy}" -m pip install --user -r requirements.txt`, { stdio: 'inherit', cwd: rootDir });
  } catch (fallbackErr) {
    console.error('[Setup Error] Global user pip install also failed:', fallbackErr.message);
  }
}
