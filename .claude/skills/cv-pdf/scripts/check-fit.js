#!/usr/bin/env node
/**
 * Fit checker for the CV generator.
 *
 * The CV layout is a fixed A4 box: body is 297mm tall with overflow:hidden,
 * .main-content is height:100%/overflow:hidden, and index.js renders with
 * pageRanges:'1'. Anything past the bottom of the page is silently clipped
 * rather than flowing onto page 2 -- so a CV can lose its last role without
 * any warning in the generator output.
 *
 * This renders a CV variant exactly like src/index.js does (people/<person>/profile.json
 * merged with people/<person>/cvs/<variant>.json, using that person's own layout),
 * then measures how much content actually overflows each column, and writes a PNG
 * preview so the result can be inspected visually.
 *
 * Usage:  node .claude/skills/cv-pdf/scripts/check-fit.js <person> <variant>
 * Exit:   0 = fits, 1 = overflows (clipped), 2 = error
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const SRC = path.join(PROJECT_ROOT, 'src');

const { inlineCssLinks } = require(path.join(SRC, 'utils/inlineCssLinks'));
const { embedImagesAsDataUrls } = require(path.join(SRC, 'utils/embedImagesAsDataUrls'));
const { injectCvData } = require(path.join(SRC, 'utils/injectCvData'));
const { buildCvFromJson } = require(path.join(SRC, 'utils/buildCvFromJson'));
const { loadCvData } = require(path.join(SRC, 'utils/loadCvData'));

const silent = { log() {}, warn() {}, error() {} };

async function checkFit(person, variant) {
  const personDir = path.join(PROJECT_ROOT, 'people', person);
  const jsonPath = path.join(personDir, 'cvs', variant.endsWith('.json') ? variant : `${variant}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.error(`CV variant not found: ${jsonPath}`);
    return 2;
  }

  const cvData = loadCvData(personDir, jsonPath);
  const outputName = cvData.meta?.outputName || path.basename(jsonPath, '.json');

  let html = buildCvFromJson(cvData, path.join(personDir, 'templates/cv-layout.html'), path.join(personDir, 'components'), silent);
  html = inlineCssLinks(html, path.join(personDir, 'templates'), silent);
  html = embedImagesAsDataUrls(html, personDir, silent);

  const browser = await puppeteer.launch({
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await injectCvData(page, cvData);
    await page.setViewport({
      width: Math.round(210 * 3.779528),
      height: Math.round(297 * 3.779528),
      deviceScaleFactor: 2,
    });
    await page.emulateMediaType('print');

    const report = await page.evaluate(() => {
      const pageHeight = document.body.getBoundingClientRect().height;

      // Measure where content actually ends by taking the lowest rendered
      // descendant. scrollHeight is no good here: .main-content is a fixed
      // height:100% box, so its scrollHeight saturates at the page height and
      // can't show headroom. getBoundingClientRect is unaffected by
      // overflow:hidden clipping -- clipping is visual only -- so it reports
      // true positions whether content fits or spills past the page edge.
      const measure = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;

        let contentBottom = el.getBoundingClientRect().top;
        for (const node of el.querySelectorAll('*')) {
          const r = node.getBoundingClientRect();
          if (r.height === 0 && r.width === 0) continue; // hidden / empty
          if (r.bottom > contentBottom) contentBottom = r.bottom;
        }
        return {
          contentBottom,
          overflowPx: Math.max(0, contentBottom - pageHeight),
        };
      };

      const sectionTitles = (selector) =>
        Array.from(document.querySelectorAll(`${selector} .section-title`)).map((el) => ({
          text: el.textContent.trim(),
          bottom: Math.round(el.getBoundingClientRect().bottom),
        }));

      return {
        pageHeight: Math.round(pageHeight),
        main: measure('.main-content'),
        sidebar: measure('.sidebar'),
        mainSections: sectionTitles('.main-content'),
        sidebarSections: sectionTitles('.sidebar'),
      };
    });

    const previewPath = path.join(PROJECT_ROOT, 'output', person, `${outputName}.preview.png`);
    fs.mkdirSync(path.dirname(previewPath), { recursive: true });
    await page.screenshot({ path: previewPath, fullPage: false });

    const mainOver = Math.round(report.main?.overflowPx || 0);
    const sideOver = Math.round(report.sidebar?.overflowPx || 0);
    const pageH = report.pageHeight;

    // ~3.78px per mm at this scale; report mm because the layout is specified in mm.
    const mm = (px) => (px / 3.779528).toFixed(1);

    console.log(`Fit check: ${person}/${path.basename(jsonPath)}  (page height ${pageH}px / 297mm)`);
    console.log('');
    console.log(`  main column     content ends at ${Math.round(report.main?.contentBottom || 0)}px` +
      (mainOver > 0 ? `  OVERFLOW +${mainOver}px (~${mm(mainOver)}mm CLIPPED)` : `  fits (${mm(pageH - (report.main?.contentBottom || 0))}mm to spare)`));
    console.log(`  sidebar column  content ends at ${Math.round(report.sidebar?.contentBottom || 0)}px` +
      (sideOver > 0 ? `  OVERFLOW +${sideOver}px (~${mm(sideOver)}mm CLIPPED)` : `  fits (${mm(pageH - (report.sidebar?.contentBottom || 0))}mm to spare)`));

    const clipped = (sections, colName) => {
      const cut = sections.filter((s) => s.bottom > pageH);
      if (cut.length) {
        console.log(`\n  ${colName} sections starting below the page edge: ${cut.map((s) => s.text).join(', ')}`);
      }
    };
    clipped(report.mainSections, 'main');
    clipped(report.sidebarSections, 'sidebar');

    console.log(`\n  preview: ${previewPath}`);
    console.log('  (Read this PNG to see exactly what the page looks like -- the preview');
    console.log('   shows the same clipping the PDF will have.)');

    if (mainOver > 0 || sideOver > 0) {
      console.log('\nRESULT: OVERFLOW -- content is being cut off. Trim before shipping this CV.');
      return 1;
    }
    console.log('\nRESULT: FITS on one page.');
    return 0;
  } finally {
    await browser.close();
  }
}

const [person, variant] = process.argv.slice(2);
if (!person || !variant) {
  console.error('Usage: node .claude/skills/cv-pdf/scripts/check-fit.js <person> <variant>');
  process.exit(2);
}

checkFit(person, variant)
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fit check failed:', err);
    process.exit(2);
  });
