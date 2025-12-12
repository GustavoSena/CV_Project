const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const { inlineCssLinks } = require('./utils/inlineCssLinks');
const { embedImagesAsDataUrls } = require('./utils/embedImagesAsDataUrls');
const { loadJsonIfExists } = require('./utils/loadJsonIfExists');
const { injectCvData } = require('./utils/injectCvData');
const { buildCvFromJson } = require('./utils/buildCvFromJson');

/**
 * Generate PDF from a JSON data file (new approach)
 */
async function generatePDFFromJson(jsonFilePath, browser) {
  const docDir = path.join(__dirname, 'doc');
  const templatesDir = path.join(docDir, 'templates');
  const componentsDir = path.join(docDir, 'components');
  
  try {
    // Load CV data from JSON
    const cvData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    const outputName = cvData.meta?.outputName || path.basename(jsonFilePath, '.json');
    
    console.log(`Building CV from JSON: ${path.basename(jsonFilePath)}`);

    // Build HTML from layout template + components + data
    const layoutPath = path.join(templatesDir, 'cv-layout.html');
    let htmlContent = buildCvFromJson(cvData, layoutPath, componentsDir, console);

    // Inline CSS (resolve relative to templates dir, then try doc dir)
    htmlContent = inlineCssLinks(htmlContent, templatesDir, console);

    // Embed images (resolve relative to doc dir where photos are)
    htmlContent = embedImagesAsDataUrls(htmlContent, docDir, console);

    // Create page and set content
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Inject data into the DOM (handles repeats, bindings, etc.)
    await injectCvData(page, cvData);

    // Set viewport to A4 size with high DPI
    await page.setViewport({
      width: Math.round(210 * 3.779528),
      height: Math.round(297 * 3.779528),
      deviceScaleFactor: 2,
    });

    await page.emulateMediaType('print');

    // Create output directory
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    // Generate PDF
    const outputPath = path.join(outputDir, `${outputName}.pdf`);
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: false,
      scale: 1.0,
      omitBackground: false,
      displayHeaderFooter: false,
      pageRanges: '1'
    });

    console.log(`PDF generated successfully: ${outputPath}`);
    console.log(`PDF size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

    await page.close();
  } catch (error) {
    console.error(`Error processing ${jsonFilePath}:`, error);
  }
}

/**
 * Legacy: Generate PDF from an HTML file (backwards compatibility)
 */
async function generatePDFForFile(htmlFilePath, browser) {
  const { expandHtmlIncludes } = require('./utils/expandHtmlIncludes');
  const fileName = path.basename(htmlFilePath, '.html');
  const htmlDir = path.dirname(htmlFilePath);
  
  try {
    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    htmlContent = expandHtmlIncludes(htmlContent, htmlDir, console);

    const commonDataPath = path.join(htmlDir, 'common', 'cv-data.json');
    const cvData = loadJsonIfExists(commonDataPath, console);

    htmlContent = inlineCssLinks(htmlContent, htmlDir, console);
    htmlContent = embedImagesAsDataUrls(htmlContent, htmlDir, console);
    
    // Create a new page for PDF generation
    const page = await browser.newPage();
    
    // Set content to the page with embedded images
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0'
    });

    // Inject common data into the HTML without changing layout.
    // Only modifies nodes explicitly marked with data-cv-* attributes.
    if (cvData) {
      await injectCvData(page, cvData);
    }

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

async function generatePDFs(specificFile = null) {
  const browser = await puppeteer.launch({
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ]
  });
  
  try {
    const docDir = path.join(__dirname, 'doc');
    const dataDir = path.join(docDir, 'data');
    
    if (!fs.existsSync(docDir)) {
      console.error(`Doc directory not found at: ${docDir}`);
      return;
    }
    
    // Check if argument is a JSON file (new approach) or HTML file (legacy)
    if (specificFile) {
      // Try JSON first (new approach)
      const jsonPath = specificFile.endsWith('.json') 
        ? path.join(dataDir, specificFile)
        : path.join(dataDir, `${specificFile}.json`);
      
      if (fs.existsSync(jsonPath)) {
        console.log(`Using JSON-driven generation: ${path.basename(jsonPath)}`);
        await generatePDFFromJson(jsonPath, browser);
        console.log('PDF generated successfully.');
        return;
      }
      
      // Fallback to HTML (legacy)
      const htmlPath = specificFile.endsWith('.html')
        ? path.join(docDir, specificFile)
        : path.join(docDir, `${specificFile}.html`);
      
      if (fs.existsSync(htmlPath)) {
        console.log(`Using legacy HTML generation: ${path.basename(htmlPath)}`);
        await generatePDFForFile(htmlPath, browser);
        console.log('PDF generated successfully.');
        return;
      }
      
      console.error(`File not found: ${specificFile} (tried both JSON and HTML)`);
      return;
    }
    
    // No specific file - process all JSON files in data directory
    if (fs.existsSync(dataDir)) {
      const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
      if (jsonFiles.length > 0) {
        console.log(`Found ${jsonFiles.length} JSON data files to process.`);
        for (const jsonFile of jsonFiles) {
          await generatePDFFromJson(path.join(dataDir, jsonFile), browser);
        }
        console.log('All PDF files generated successfully.');
        return;
      }
    }
    
    // Fallback: process HTML files (legacy)
    const htmlFiles = fs.readdirSync(docDir).filter(f => f.endsWith('.html'));
    if (htmlFiles.length === 0) {
      console.log('No JSON or HTML files found to process.');
      return;
    }
    
    console.log(`Found ${htmlFiles.length} HTML files to process (legacy mode).`);
    for (const htmlFile of htmlFiles) {
      await generatePDFForFile(path.join(docDir, htmlFile), browser);
    }
    console.log('All PDF files generated successfully.');
  } catch (error) {
    console.error('Error generating PDFs:', error);
  } finally {
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
