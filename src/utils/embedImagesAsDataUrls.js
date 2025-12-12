const fs = require('fs');
const path = require('path');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function embedImagesAsDataUrls(htmlContent, htmlDir, logger = console) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  let match;
  const originalHtmlContent = htmlContent;

  while ((match = imgRegex.exec(originalHtmlContent)) !== null) {
    const imgSrc = match[1];

    if (imgSrc.startsWith('data:')) continue;

    const imgPath = path.join(htmlDir, imgSrc);
    if (logger && typeof logger.log === 'function') {
      logger.log(`Processing image: ${imgSrc}, full path: ${imgPath}`);
    }

    if (fs.existsSync(imgPath)) {
      try {
        const imgBuffer = fs.readFileSync(imgPath);
        const mimeType = getContentType(imgPath);
        const base64Data = imgBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        htmlContent = htmlContent.replace(new RegExp(escapeRegExp(imgSrc), 'g'), dataUrl);
        if (logger && typeof logger.log === 'function') {
          logger.log(`Successfully embedded high-quality image: ${imgSrc}`);
        }
      } catch (imgError) {
        if (logger && typeof logger.error === 'function') {
          logger.error(`Error embedding image ${imgPath}:`, imgError);
        }
      }
    } else if (logger && typeof logger.warn === 'function') {
      logger.warn(`Image not found: ${imgPath}`);
    }
  }

  return htmlContent;
}

module.exports = { embedImagesAsDataUrls };
