const fs = require('fs');

function loadJsonIfExists(filePath, logger = console) {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`Failed to parse JSON at ${filePath}:`, err);
    }
    return null;
  }
}

module.exports = { loadJsonIfExists };
