const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'app');
const files = [
  'order/[id].tsx','tracking.tsx','orders.tsx','checkout.tsx','order-success.tsx',
  '(tabs)/chat/[id].tsx','promotions.tsx','notifications/[id].tsx','notifications/index.tsx',
  'category/[id].tsx','contact.tsx','help.tsx','account/personal-info.tsx','account/payment-methods.tsx',
  'account/loyalty.tsx','account/addresses.tsx','about.tsx','(tabs)/explore.tsx','product/[id].tsx',
  '(tabs)/chat/index.tsx','(tabs)/profile.tsx','(tabs)/cart.tsx','(tabs)/index.tsx','(tabs)/search.tsx',
  'search.tsx','product/reviews/[id].tsx','payment-setup/[id].tsx','legal.tsx','account/favorites.tsx',
  '(tabs)/chat/_layout.tsx'
];

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (inLineComment) { if (c === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (c === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** Find function body start — skip param destructuring braces */
function findBodyOpen(src, funcStart) {
  // Find the ')' that closes the parameter list, then '{'
  let i = src.indexOf('(', funcStart);
  if (i < 0) return -1;
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        const rest = src.slice(i + 1);
        const m = rest.match(/^(\s*(?::\s*[^{]+)?)\s*\{/);
        if (!m) return -1;
        return i + 1 + m[0].length - 1; // index of {
      }
    }
  }
  return -1;
}

for (const rel of files) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const issues = [];
  if (/const styles = StyleSheet\.create/.test(src)) issues.push('const styles');
  if (/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"]@\/constants\/theme['"]/.test(src)) issues.push('imports colors');

  const re = /^(export\s+default\s+)?function\s+(\w+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[2];
    if (name === 'createStyles') continue;
    const braceOpen = findBodyOpen(src, m.index);
    if (braceOpen < 0) { issues.push(`no body for ${name}`); continue; }
    const braceClose = findMatchingBrace(src, braceOpen);
    const body = src.slice(braceOpen + 1, braceClose);
    const params = src.slice(m.index, braceOpen);
    const hasHooks = /useColors\(\)/.test(body);
    const usesStyles = /\bstyles\./.test(body) || /\bstyles\b/.test(body) && /\bstyle=\{/.test(body);
    const usesColors = /\bcolors\./.test(body);
    const isPascal = /^[A-Z]/.test(name);
    const getsViaProps = /\bcolors\b/.test(params) || /\bstyles\b/.test(params);

    if (hasHooks && !isPascal) issues.push(`hooks in helper ${name}`);
    if (isPascal && (usesStyles || usesColors) && !hasHooks && !getsViaProps) {
      issues.push(`${name} missing hooks`);
    }
    if (!isPascal && hasHooks) {
      // already covered
    }
    // hooks after return
    if (hasHooks) {
      const hookIdx = body.search(/const colors = useColors/);
      const before = body.slice(0, hookIdx);
      if (/\breturn\b/.test(before)) issues.push(`${name} return before hooks`);
    }
  }

  // Syntax smoke: PulseDot corruption pattern
  if (/function \w+\(\{\s*\n\s*const colors/.test(src)) issues.push('corrupted destructuring');

  console.log((issues.length ? 'FAIL' : 'OK  ') + ' ' + rel + (issues.length ? ' — ' + issues.join('; ') : ''));
}
