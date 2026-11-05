const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const { inlineCssLinks } = require('./utils/inlineCssLinks');
const { embedImagesAsDataUrls } = require('./utils/embedImagesAsDataUrls');
const { injectCvData } = require('./utils/injectCvData');
const { buildCvFromJson } = require('./utils/buildCvFromJson');
const { loadCvData } = require('./utils/loadCvData');

const ROOT_DIR = path.join(__dirname, '..');
const PEOPLE_DIR = path.join(ROOT_DIR, 'people');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
// Skipped when building everyone; build it explicitly with `node src/index.js example`.
const EXAMPLE_PERSON = 'example';

/**
 * Generate a PDF for one CV variant of a person.
 * Everything except this engine (layout, components, CSS, photos, data) comes from personDir.
 */
async function generatePDFFromJson(personDir, jsonFilePath, browser) {
  const person = path.basename(personDir);
  const templatesDir = path.join(personDir, 'templates');
  const componentsDir = path.join(personDir, 'components');

  try {
    // Load CV data: profile.json merged with the variant
    const cvData = loadCvData(personDir, jsonFilePath);
    const outputName = cvData.meta?.outputName || path.basename(jsonFilePath, '.json');

    console.log(`Building CV: ${person}/${path.basename(jsonFilePath)}`);

    // Build HTML from layout template + components + data
    const layoutPath = path.join(templatesDir, 'cv-layout.html');
    let htmlContent = buildCvFromJson(cvData, layoutPath, componentsDir, console);

    // Inline CSS (resolve relative to templates dir, then try doc dir)
    htmlContent = inlineCssLinks(htmlContent, templatesDir, console);

    // Embed images (resolve relative to the person's folder, where photos/ lives)
    htmlContent = embedImagesAsDataUrls(htmlContent, personDir, console);

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

    // Create output directory (one per person)
    const outputDir = path.join(OUTPUT_DIR, person);
    fs.mkdirSync(outputDir, { recursive: true });

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
    process.exitCode = 1;
  }
}

// statSync follows symlinks, so a person folder can live outside the repo; broken links are skipped.
function isDirectory(entryPath) {
  try {
    return fs.statSync(entryPath).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ELOOP') {
      console.warn(`Skipping broken link: ${entryPath}`);
      return false;
    }
    throw error;
  }
}

/**
 * Lists the CV variants to build as { personDir, jsonPath }.
 * No person: every person except the example. No variant: every file in the person's cvs/.
 */
function findCvVariants(person, variant) {
  const people = person
    ? [person]
    : fs.readdirSync(PEOPLE_DIR)
        .filter((name) => name !== EXAMPLE_PERSON && isDirectory(path.join(PEOPLE_DIR, name)));

  const variants = [];
  for (const name of people) {
    const personDir = path.join(PEOPLE_DIR, name);
    const cvsDir = path.join(personDir, 'cvs');
    if (!fs.existsSync(cvsDir)) {
      console.error(`No cvs/ folder for "${name}": ${cvsDir}`);
      process.exitCode = 1;
      continue;
    }

    const files = variant
      ? [variant.endsWith('.json') ? variant : `${variant}.json`]
      : fs.readdirSync(cvsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      const jsonPath = path.join(cvsDir, file);
      if (!fs.existsSync(jsonPath)) {
        console.error(`CV variant not found: ${jsonPath}`);
        process.exitCode = 1;
        continue;
      }
      variants.push({ personDir, jsonPath });
    }
  }
  return variants;
}

async function generatePDFs(person = null, variant = null) {
  if (!fs.existsSync(PEOPLE_DIR)) {
    console.error(`People directory not found at: ${PEOPLE_DIR}`);
    process.exitCode = 1;
    return;
  }

  const variants = findCvVariants(person, variant);
  if (variants.length === 0) {
    console.log(`No CVs found to build in ${PEOPLE_DIR}.`);
    if (!person) {
      console.log(`Note: "${EXAMPLE_PERSON}" is skipped unless named: node src/index.js ${EXAMPLE_PERSON}`);
    }
    return;
  }

  const browser = await puppeteer.launch({
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ]
  });

  try {
    console.log(`Found ${variants.length} CV(s) to build.`);
    for (const { personDir, jsonPath } of variants) {
      await generatePDFFromJson(personDir, jsonPath, browser);
    }
  } catch (error) {
    console.error('Error generating PDFs:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

// Usage: node src/index.js [person] [variant]
const [person = null, variant = null] = process.argv.slice(2);

generatePDFs(person, variant).catch(error => {
  console.error('Error in main process:', error);
  process.exitCode = 1;
});
