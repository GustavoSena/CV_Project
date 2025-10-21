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
          // Create a temporary HTML file for image optimization
          const tempHtmlPath = path.join(__dirname, 'temp_image.html');
          fs.writeFileSync(tempHtmlPath, `
            <html>
              <head>
                <style>
                  body { margin: 0; padding: 0; }
                  .container { width: 100px; height: 100px; overflow: hidden; }
                  img { width: 100px; height: 100px; object-fit: cover; }
                </style>
              </head>
              <body>
                <div class="container">
                  <img src="file:///${path.resolve(imgPath).replace(/\\/g, '/')}" alt="Image">
                </div>
              </body>
            </html>
          `);
          
          // Create a page for image optimization
          const imagePage = await browser.newPage();
          
          // Navigate to the temporary HTML file
          await imagePage.goto(`file:///${path.resolve(tempHtmlPath).replace(/\\/g, '/')}`, {
            waitUntil: 'networkidle0'
          });
          
          // Wait for the image to load
          await imagePage.waitForSelector('img');
          
          // Take a screenshot of just the image container
          const screenshotBuffer = await imagePage.screenshot({
            clip: {
              x: 0,
              y: 0,
              width: 100,
              height: 100
            },
            type: 'jpeg',
            quality: 100,
            omitBackground: true
          });
          
          // Close the page
          await imagePage.close();
          
          // Clean up the temporary HTML file
          try {
            fs.unlinkSync(tempHtmlPath);
          } catch (e) {
            console.warn('Could not delete temporary HTML file:', e);
          }
          
          // Convert the screenshot to a data URL
          const base64Data = screenshotBuffer.toString('base64');
          const dataUrl = `data:image/jpeg;base64,${base64Data}`;
          
          // Replace the image source with the data URL
          htmlContent = htmlContent.replace(new RegExp(escapeRegExp(imgSrc), 'g'), dataUrl);
          console.log(`Successfully embedded optimized image: ${imgSrc}`);
        } catch (imgError) {
          console.warn(`Error optimizing image ${imgPath}:`, imgError);
          
          // Fallback to direct embedding if optimization fails
          try {
            console.log('Falling back to direct image embedding');
            const imgBuffer = fs.readFileSync(imgPath);
            const mimeType = getContentType(imgPath);
            const base64Data = imgBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64Data}`;
            htmlContent = htmlContent.replace(new RegExp(escapeRegExp(imgSrc), 'g'), dataUrl);
            console.log(`Successfully embedded image using fallback: ${imgSrc}`);
          } catch (fallbackError) {
            console.error(`Fallback image embedding failed: ${fallbackError}`);
          }
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

    // Set viewport to A4 size (A4 is 210mm × 297mm)
    await page.setViewport({
      width: Math.round(210 * 3.779528),
      height: Math.round(297 * 3.779528),
      deviceScaleFactor: 1,
    });

    // Add custom CSS to ensure the sidebar extends to the edge
    await page.addStyleTag({
      content: `
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 210mm !important;
          height: 297mm !important;
          overflow: hidden !important;
        }
        .sidebar {
          position: absolute !important;
          right: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 30% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 6mm 4mm !important;
          box-sizing: border-box !important;
        }
        body::before {
          right: 0 !important;
          width: 30% !important;
          height: 100% !important;
        }
        .main-content {
          margin-right: 30% !important;
        }
      `
    });

    // Create the output directory if it doesn't exist
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Generate the PDF file with extreme optimization settings
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
      compress: true,
      quality: 50,
      dpi: 72,
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

async function generatePDFs() {
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
    
    // Read all files in the doc directory
    const files = fs.readdirSync(docDir);
    
    // Filter for HTML files
    const htmlFiles = files.filter(file => path.extname(file).toLowerCase() === '.html');
    
    if (htmlFiles.length === 0) {
      console.log('No HTML files found in the doc directory.');
      return;
    }
    
    console.log(`Found ${htmlFiles.length} HTML files to process.`);
    
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

// Execute the function
generatePDFs().catch(error => {
  console.error('Error in main process:', error);
});
