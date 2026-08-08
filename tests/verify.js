const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('--- Starting CrevoDoc Converter Backend Verification ---');

// 1. Verify Directories
const dirs = ['uploads', 'downloads', 'public', 'scripts', 'views', 'src'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    console.log(`[OK] Directory exists: ${dir}`);
  } else {
    console.error(`[FAIL] Directory missing: ${dir}`);
    process.exit(1);
  }
});

// 2. Verify Python Virtual Environment & Modules
function checkPythonEnv() {
  return new Promise((resolve) => {
    const pythonExe = path.join(__dirname, '../.venv/Scripts/python.exe');
    if (!fs.existsSync(pythonExe)) {
      console.error('[FAIL] Python virtual environment NOT found at .venv/Scripts/python.exe');
      process.exit(1);
    }
    console.log('[OK] Python virtual environment found.');

    // Test imports in Python
    const testImportScript = `
import pymupdf
import docx
import pptx
import PIL
import pdf2docx
print("PYTHON_IMPORTS_OK")
`;

    const pyProcess = spawn(pythonExe, ['-c', testImportScript]);
    let output = '';
    let error = '';

    pyProcess.stdout.on('data', data => output += data.toString());
    pyProcess.stderr.on('data', data => error += data.toString());

    pyProcess.on('close', code => {
      // Clean warnings or output
      const stdoutClean = output.trim();
      if (code === 0 && stdoutClean.includes('PYTHON_IMPORTS_OK')) {
        console.log('[OK] Python dependencies verified successfully.');
        resolve();
      } else {
        console.error('[FAIL] Python dependency test failed:', error || output);
        process.exit(1);
      }
    });
  });
}

// 3. Verify Puppeteer launching capability
async function checkPuppeteer() {
  try {
    const puppeteer = require('puppeteer');
    console.log('[OK] Puppeteer package imported successfully.');
    
    console.log('Launching headless browser test...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('[OK] Headless Chromium launched successfully.');
    await browser.close();
    console.log('[OK] Headless Chromium closed successfully.');
  } catch (err) {
    console.error('[FAIL] Puppeteer browser launch test failed:', err);
    process.exit(1);
  }
}

async function run() {
  await checkPythonEnv();
  await checkPuppeteer();
  console.log('--- Verification Complete: ALL SYSTEMS FUNCTIONAL ---');
}

run();
