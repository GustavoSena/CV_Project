const fs = require('fs');
const path = require('path');

/**
 * Resolves $references in JSON data (e.g., "$education" -> data.education)
 */
function resolveReferences(value, rootData) {
  if (typeof value === 'string' && value.startsWith('$')) {
    const refPath = value.slice(1); // Remove leading $
    return getByPath(rootData, refPath);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveReferences(item, rootData));
  }
  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveReferences(v, rootData);
    }
    return resolved;
  }
  return value;
}

function getByPath(obj, pathStr) {
  if (!obj || !pathStr) return undefined;
  return pathStr.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

/**
 * Loads a component HTML file from the components directory
 */
function loadComponent(componentName, componentsDir) {
  const componentPath = path.join(componentsDir, `${componentName}.html`);
  if (!fs.existsSync(componentPath)) {
    console.warn(`Component not found: ${componentPath}`);
    return `<!-- Component not found: ${componentName} -->`;
  }
  return fs.readFileSync(componentPath, 'utf8');
}

/**
 * Builds section HTML from a section config object
 * Each section has: { component: "experience", title: "...", items: [...], ... }
 */
function buildSectionHtml(sectionConfig, componentsDir, rootData) {
  const resolved = resolveReferences(sectionConfig, rootData);
  const componentHtml = loadComponent(resolved.component, componentsDir);
  
  // Wrap the component with a data container that includes the section's data
  // We'll use data-cv-section-data attribute to pass the section config
  const sectionDataJson = JSON.stringify(resolved).replace(/"/g, '&quot;');
  
  return `<div data-cv-section-data="${sectionDataJson}">${componentHtml}</div>`;
}

/**
 * Builds the full CV HTML from JSON data and layout template
 */
function buildCvFromJson(cvData, layoutTemplatePath, componentsDir, logger = console) {
  // Load the layout template
  if (!fs.existsSync(layoutTemplatePath)) {
    throw new Error(`Layout template not found: ${layoutTemplatePath}`);
  }
  let html = fs.readFileSync(layoutTemplatePath, 'utf8');

  // Inject photo path directly into HTML (before image embedding)
  const photoPath = getByPath(cvData, 'personal.photo');
  if (photoPath) {
    html = html.replace(
      /<div([^>]*)\s+data-cv-photo="[^"]*"([^>]*)>[\s\S]*?<\/div>/,
      `<div$1$2><img src="${photoPath}" alt="Portrait" style="width: 100%; height: 100%; object-fit: cover;"></div>`
    );
  }

  // Build main sections HTML
  const mainSectionsHtml = (cvData.mainSections || [])
    .map((section) => buildSectionHtml(section, componentsDir, cvData))
    .join('\n');

  // Build sidebar sections HTML
  const sidebarSectionsHtml = (cvData.sidebarSections || [])
    .map((section) => buildSectionHtml(section, componentsDir, cvData))
    .join('\n');

  // Replace section placeholders in layout
  html = html.replace(
    /<div\s+data-cv-section="mainSections"\s*><\/div>/g,
    mainSectionsHtml
  );
  html = html.replace(
    /<div\s+data-cv-section="sidebarSections"\s*><\/div>/g,
    sidebarSectionsHtml
  );

  if (logger && typeof logger.log === 'function') {
    logger.log(`Built CV with ${cvData.mainSections?.length || 0} main sections and ${cvData.sidebarSections?.length || 0} sidebar sections`);
  }

  return html;
}

module.exports = { buildCvFromJson, resolveReferences, loadComponent };
