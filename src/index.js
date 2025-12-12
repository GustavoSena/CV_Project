const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDFForFile(htmlFilePath, browser) {
  // Extract the filename without extension for the output PDF name
  const fileName = path.basename(htmlFilePath, '.html');
  
  // Get the directory containing the HTML file
  const htmlDir = path.dirname(htmlFilePath);
  
  try {
    // Read the HTML content
    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    
    // Process external CSS links - inline them since setContent doesn't load external resources
    const cssLinkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g;
    let cssMatch;
    while ((cssMatch = cssLinkRegex.exec(htmlContent)) !== null) {
      const cssHref = cssMatch[1];
      const cssPath = path.join(htmlDir, cssHref);
      
      if (fs.existsSync(cssPath)) {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        // Replace the link tag with inline style
        htmlContent = htmlContent.replace(cssMatch[0], `<style>\n${cssContent}\n</style>`);
        console.log(`Inlined CSS: ${cssHref}`);
      } else {
        console.warn(`CSS file not found: ${cssPath}`);
      }
    }
    
    // Process image references directly
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    let match;
    let originalHtmlContent = htmlContent;
    
    while ((match = imgRegex.exec(originalHtmlContent)) !== null) {
      const imgSrc = match[1];
      
      // Skip if it's already a data URL
      if (imgSrc.startsWith('data:')) continue;
      
      // Get the absolute path to the image
      const imgPath = path.join(htmlDir, imgSrc);
      console.log(`Processing image: ${imgSrc}, full path: ${imgPath}`);
      
      if (fs.existsSync(imgPath)) {
        try {
          // Direct high-quality image embedding
          const imgBuffer = fs.readFileSync(imgPath);
          const mimeType = getContentType(imgPath);
          const base64Data = imgBuffer.toString('base64');
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          htmlContent = htmlContent.replace(new RegExp(escapeRegExp(imgSrc), 'g'), dataUrl);
          console.log(`Successfully embedded high-quality image: ${imgSrc}`);
        } catch (imgError) {
          console.error(`Error embedding image ${imgPath}:`, imgError);
        }
      } else {
        console.warn(`Image not found: ${imgPath}`);
      }
    }
    
    // Create a new page for PDF generation
    const page = await browser.newPage();
    
    // Set content to the page with embedded images
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Set viewport to A4 size (A4 is 210mm × 297mm) with high DPI for quality
    await page.setViewport({
      width: Math.round(210 * 3.779528),
      height: Math.round(297 * 3.779528),
      deviceScaleFactor: 2, // 2x for better image quality
    });

    // Enable print media type to trigger @media print styles from cv-base.css
    await page.emulateMediaType('print');

    // Create the output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Generate the PDF file with high quality settings
    const outputPath = path.join(outputDir, `${fileName}.pdf`);
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      },
      preferCSSPageSize: false,
      scale: 1.0,
      omitBackground: false,
      displayHeaderFooter: false,
      pageRanges: '1' // Only print the first page
    });

    console.log(`PDF generated successfully for ${fileName} at: ${outputPath}`);
    console.log(`PDF size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);
    
    // Close the page
    await page.close();
    
  } catch (error) {
    console.error(`Error processing ${htmlFilePath}:`, error);
  }
}

// Helper function to determine content type based on file extension
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

// Helper function to escape special characters in a string for use in a RegExp
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

async function generatePDFs(specificFile = null) {
  // Launch a headless browser with specific args to reduce PDF size
  const browser = await puppeteer.launch({
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ]
  });
  
  try {
    // Get the doc directory path
    const docDir = path.join(__dirname, 'doc');
    
    // Check if the doc directory exists
    if (!fs.existsSync(docDir)) {
      console.error(`Doc directory not found at: ${docDir}`);
      return;
    }
    
    let htmlFiles;
    
    // If a specific file is provided, only process that file
    if (specificFile) {
      const targetFile = specificFile.endsWith('.html') ? specificFile : `${specificFile}.html`;
      if (!fs.existsSync(path.join(docDir, targetFile))) {
        console.error(`File not found: ${targetFile}`);
        return;
      }
      htmlFiles = [targetFile];
      console.log(`Processing specific file: ${targetFile}`);
    } else {
      // Read all files in the doc directory
      const files = fs.readdirSync(docDir);
      
      // Filter for HTML files
      htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
      
      if (htmlFiles.length === 0) {
        console.log('No HTML files found in the doc directory.');
        return;
      }
      
      console.log(`Found ${htmlFiles.length} HTML files to process.`);
    }
    
    // Process each HTML file
    for (const htmlFile of htmlFiles) {
      const htmlFilePath = path.join(docDir, htmlFile);
      await generatePDFForFile(htmlFilePath, browser);
    }
    
    console.log('All PDF files generated successfully.');
  } catch (error) {
    console.error('Error generating PDFs:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Parse CLI arguments - get specific file if provided
const args = process.argv.slice(2);
const specificFile = args.length > 0 ? args[0] : null;

// Execute the function
generatePDFs(specificFile).catch(error => {
  console.error('Error in main process:', error);
});
