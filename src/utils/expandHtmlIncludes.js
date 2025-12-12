const fs = require('fs');
const path = require('path');

function expandHtmlIncludes(htmlContent, htmlDir, logger = console, options = {}) {
  const maxPasses = Number.isFinite(options.maxPasses) ? options.maxPasses : 5;

  // Only supports empty tags (or whitespace) between open/close.
  // Example: <div data-cv-include="common/sidebar/contact.html"></div>
  const includeRegex = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\sdata-cv-include=["']([^"']+)["']([^>]*)>\s*<\/\1>/g;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let didReplace = false;

    htmlContent = htmlContent.replace(includeRegex, (fullMatch, _tagName, _preAttrs, includeRelPath) => {
      const includeAbsPath = path.join(htmlDir, includeRelPath);
      if (!fs.existsSync(includeAbsPath)) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn(`Include file not found: ${includeAbsPath}`);
        }
        return fullMatch;
      }

      didReplace = true;
      const includeContent = fs.readFileSync(includeAbsPath, 'utf8');
      if (logger && typeof logger.log === 'function') {
        logger.log(`Included partial: ${includeRelPath}`);
      }
      return includeContent;
    });

    if (!didReplace) break;
  }

  return htmlContent;
}

module.exports = { expandHtmlIncludes };
