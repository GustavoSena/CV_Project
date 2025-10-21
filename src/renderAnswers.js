const { readFile, writeFile, mkdir, access } = require('fs/promises');
const path = require('path');

function render(qs, fmt = 'md') {
  const lines = [];

  (qs || []).forEach((item, idx) => {
    const q = (item && item.question ? String(item.question) : '').trim();

    if (fmt === 'md') {
      lines.push(`## Q${idx + 1}. ${q}`);
    } else {
      lines.push(`Q${idx + 1}. ${q}`);
    }

    const ans = item ? item.answer : '';
    let paras = [];

    if (Array.isArray(ans)) {
      paras = ans.map((p) => String(p).trim()).filter(Boolean);
    } else if (typeof ans === 'string') {
      const normalized = ans.replace(/\r\n/g, '\n');
      const parts = normalized
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      paras = parts.length ? parts : ans.trim() ? [ans.trim()] : [];
    }

    for (const p of paras) {
      lines.push(p);
      if (fmt === 'md') lines.push(''); // blank line between paragraphs in markdown
    }

    lines.push(''); // blank line between questions
  });

  return lines.join('\n').trimEnd() + '\n';
}

function renderExperience(prompt, answer, fmt = 'md') {
  const lines = [];
  const title = (prompt || 'Experience').trim();
  if (fmt === 'md') {
    lines.push(`# ${title}`);
    lines.push('');
  } else {
    lines.push(`${title}`);
    lines.push('');
  }
  const paras = Array.isArray(answer) ? answer.map((p) => String(p).trim()).filter(Boolean) : [];
  for (const p of paras) {
    lines.push(p);
    if (fmt === 'md') lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function defaultOutPathForInput(inputPath, fmt) {
  const ext = fmt === 'text' ? 'txt' : 'md';
  const bn = path.basename(inputPath).toLowerCase();
  if (bn === 'questions.json') return path.resolve(process.cwd(), 'output', `answers.${ext}`);
  if (bn === 'solidity_experience.json') return path.resolve(process.cwd(), 'output', `experience.${ext}`);
  if (bn === 'crypto_space_experience.json') return path.resolve(process.cwd(), 'output', `crypto_experience.${ext}`);
  return path.resolve(process.cwd(), 'output', `output.${ext}`);
}

async function handleSingle(input, fmt, output) {
  const raw = await readFile(input, 'utf-8');
  const data = JSON.parse(raw);
  let out = '';
  if (Array.isArray(data.questions)) {
    const qs = data.questions;
    out = render(qs, fmt);
  } else if (Array.isArray(data.answer)) {
    out = renderExperience(data.prompt || '', data.answer, fmt);
  } else {
    throw new Error(`Unrecognized input format for ${input}`);
  }

  const outPath = output ? path.resolve(process.cwd(), output) : defaultOutPathForInput(input, fmt);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, out, 'utf-8');
  if (process.env.CI !== 'true') console.log(`Wrote ${fmt} to ${outPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  let input = '';
  let fmt = 'md';
  let output = '';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--input' || a === '-i') {
      input = args[++i] || '';
      continue;
    }
    if (a === '--format' || a === '-f') {
      const v = (args[++i] || '').toLowerCase();
      fmt = v === 'text' ? 'text' : 'md';
      continue;
    }
    if (a === '--output' || a === '-o') {
      output = args[++i] || '';
      continue;
    }
  }

  if (input) {
    // Single-file mode
    input = path.resolve(process.cwd(), input);
    await handleSingle(input, fmt, output);
    return;
  }

  // Default: export both known files if present
  const qPath = path.resolve(__dirname, '../helpful_info/questions.json');
  const expPath = path.resolve(__dirname, '../helpful_info/solidity_experience.json');
  const cPath = path.resolve(__dirname, '../helpful_info/crypto_space_experience.json');

  const tasks = [];
  // Use access() to test existence
  try { await access(qPath); tasks.push(handleSingle(qPath, fmt, '')); } catch { /* skip */ }
  try { await access(expPath); tasks.push(handleSingle(expPath, fmt, '')); } catch { /* skip */ }
  try { await access(cPath); tasks.push(handleSingle(cPath, fmt, '')); } catch { /* skip */ }

  if (tasks.length === 0) {
    throw new Error('No input files found: expected helpful_info/questions.json and/or helpful_info/solidity_experience.json');
  }
  await Promise.all(tasks);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { render };
