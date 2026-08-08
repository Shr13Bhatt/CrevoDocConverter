const fs = require('fs');
const path = require('path');

const TEMP_DIRS = [
  path.join(__dirname, '../uploads'),
  path.join(__dirname, '../downloads')
];

// File expiration threshold: 30 minutes
const MAX_AGE_MS = 30 * 60 * 1000;

function cleanTempFiles() {
  console.log('[Cleanup] Running file cleaner check...');
  const now = Date.now();
  let deletedCount = 0;

  for (const dir of TEMP_DIRS) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`[Cleanup] Error creating directory ${dir}:`, err);
      }
      continue;
    }

    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          const age = now - stats.mtimeMs;
          
          if (age > MAX_AGE_MS) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            deletedCount++;
            console.log(`[Cleanup] Cleaned up ${filePath} (Age: ${Math.round(age / 1000 / 60)}m)`);
          }
        } catch (statErr) {
          console.error(`[Cleanup] Error examining path ${filePath}:`, statErr);
        }
      }
    } catch (dirErr) {
      console.error(`[Cleanup] Error listing files in ${dir}:`, dirErr);
    }
  }

  if (deletedCount > 0) {
    console.log(`[Cleanup] Cleanup completed. Removed ${deletedCount} files/folders.`);
  }
}

module.exports = {
  cleanTempFiles
};
