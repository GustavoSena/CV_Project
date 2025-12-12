const fs = require('fs');
const path = require('path');

function inlineCssLinks(htmlContent, htmlDir, logger = console) {
  const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g;

  return htmlContent.replace(cssLinkRegex, (fullMatch, cssHref) => {
    const cssPath = path.join(htmlDir, cssHref);

    if (fs.existsSync(cssPath)) {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      if (logger && typeof logger.log === 'function') {
        logger.log(`Inlined CSS: ${cssHref}`);
      }
      return `<style>\n${cssContent}\n</style>`;
    }

    if (logger && typeof logger.warn === 'function') {
      logger.warn(`CSS file not found: ${cssPath}`);
    }
    return fullMatch;
  });
}

module.exports = { inlineCssLinks };
