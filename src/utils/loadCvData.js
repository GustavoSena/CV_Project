const fs = require('fs');
const path = require('path');

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep-merges `override` onto `base`. Objects merge key by key;
 * arrays and primitives in `override` replace those in `base`.
 */
function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return merged;
}

/**
 * Loads a CV variant for a person: `<personDir>/profile.json` (optional,
 * shared across variants) deep-merged with the variant file on top.
 */
function loadCvData(personDir, variantPath) {
  const profilePath = path.join(personDir, 'profile.json');
  const profile = fs.existsSync(profilePath)
    ? JSON.parse(fs.readFileSync(profilePath, 'utf8'))
    : {};
  const variant = JSON.parse(fs.readFileSync(variantPath, 'utf8'));
  return deepMerge(profile, variant);
}

module.exports = { loadCvData, deepMerge };
