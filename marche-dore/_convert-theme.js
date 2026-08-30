const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'app');
const files = [
  'order/[id].tsx',
  'tracking.tsx',
  'orders.tsx',
  'checkout.tsx',
  'order-success.tsx',
  '(tabs)/chat/[id].tsx',
  'promotions.tsx',
  'notifications/[id].tsx',
  'notifications/index.tsx',
  'category/[id].tsx',
  'contact.tsx',
  'help.tsx',
  'account/personal-info.tsx',
  'account/payment-methods.tsx',
  'account/loyalty.tsx',
  'account/addresses.tsx',
  'about.tsx',
  '(tabs)/explore.tsx',
  'product/[id].tsx',
  '(tabs)/chat/index.tsx',
  '(tabs)/profile.tsx',
  '(tabs)/cart.tsx',
  '(tabs)/index.tsx',
  '(tabs)/search.tsx',
  'search.tsx',
  'product/reviews/[id].tsx',
  'payment-setup/[id].tsx',
  'legal.tsx',
  'account/favorites.tsx',
  '(tabs)/chat/_layout.tsx',
];

function updateThemeImport(src) {
  return src.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]@\/constants\/theme['"]\s*;?/,
    (match, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((p) => p !== 'colors' && !p.startsWith('colors as') && p !== 'type AppColors' && p !== 'AppColors');
      const hasType = parts.some((p) => p.includes('AppColors'));
      if (!hasType) parts.push('type AppColors');
      // If only AppColors left and no other theme exports needed, still ok
      const cleaned = parts.filter((p, i, a) => a.indexOf(p) === i);
      if (cleaned.length === 1 && cleaned[0] === 'type AppColors') {
        return `import { type AppColors } from '@/constants/theme';`;
      }
      return `import { ${cleaned.join(', ')} } from '@/constants/theme';`;
    },
  );
}

function ensureUseColorsImport(src) {
  if (src.includes("from '@/context/ThemeContext'")) {
    if (!/useColors/.test(src.match(/import\s*\{[^}]*\}\s*from\s*['"]@\/context\/ThemeContext['"]/)?.[0] ?? '')) {
      return src.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@\/context\/ThemeContext['"]/,
        (m, inner) => {
          const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
          if (!parts.includes('useColors')) parts.push('useColors');
          return `import { ${parts.join(', ')} } from '@/context/ThemeContext'`;
        },
      );
    }
    return src;
  }
  // Insert after theme import
  if (/from ['"]@\/constants\/theme['"]/.test(src)) {
    return src.replace(
      /(import\s*\{[^}]*\}\s*from\s*['"]@\/constants\/theme['"]\s*;?\n)/,
      `$1import { useColors } from '@/context/ThemeContext';\n`,
    );
  }
  return `import { useColors } from '@/context/ThemeContext';\n` + src;
}

function ensureUseMemo(src) {
  // Already has useMemo from 'react'
  if (/import\s*\{[^}]*\buseMemo\b[^}]*\}\s*from\s*['"]react['"]/.test(src)) return src;
  // Has react import with named imports
  if (/import\s*\{[^}]+\}\s*from\s*['"]react['"]/.test(src)) {
    return src.replace(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/, (m, inner) => {
      const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.includes('useMemo')) parts.unshift('useMemo');
      return `import { ${parts.join(', ')} } from 'react'`;
    });
  }
  // Has default react import
  if (/import\s+React\b/.test(src) || /import\s+\*\s+as\s+React\b/.test(src)) {
    // add separate useMemo import
    return src.replace(
      /(import\s+(?:\*\s+as\s+React|React)[^;]*;?\n)/,
      `$1import { useMemo } from 'react';\n`,
    );
  }
  // No react import — add one. Prefer before react-native import
  if (/from 'react-native'/.test(src)) {
    return src.replace(
      /(import\s+[^;]+from\s*['"]react-native['"]\s*;?\n)/,
      `import { useMemo } from 'react';\n$1`,
    );
  }
  return `import { useMemo } from 'react';\n` + src;
}

function wrapCreateStyles(src) {
  if (!/const styles = StyleSheet\.create\(/.test(src)) return src;
  if (/function createStyles\(/.test(src)) return src;

  src = src.replace(
    /const styles = StyleSheet\.create\(/,
    'function createStyles(colors: AppColors) {\n  return StyleSheet.create(',
  );

  // Find the StyleSheet.create call and add closing brace after its matching paren
  const marker = 'return StyleSheet.create(';
  const idx = src.lastIndexOf(marker);
  if (idx === -1) return src;
  let i = idx + marker.length;
  let depth = 1;
  let inStr = null;
  let escape = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        // after ); possibly
        let end = i + 1;
        if (src[end] === ';') end++;
        // insert }\n after
        src = src.slice(0, end) + '\n}' + src.slice(end);
        break;
      }
    }
  }
  return src;
}

function findMatchingBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function componentUsesStylesOrColors(body) {
  // Ignore createStyles parameter shadowing inside nested functions? 
  // Look for styles. or standalone colors. usage (not in type annotations)
  if (/\bstyles\b/.test(body)) return true;
  if (/\bcolors\./.test(body)) return true;
  return false;
}

function alreadyHasHooks(body) {
  return /const colors = useColors\(\)/.test(body) || /useMemo\(\s*\(\)\s*=>\s*createStyles/.test(body);
}

function insertHooksInComponent(src, funcStart) {
  // funcStart points at 'function Name' or 'export default function Name'
  const braceOpen = src.indexOf('{', funcStart);
  if (braceOpen === -1) return src;
  const braceClose = findMatchingBrace(src, braceOpen);
  if (braceClose === -1) return src;
  const body = src.slice(braceOpen + 1, braceClose);
  if (!componentUsesStylesOrColors(body)) return src;
  if (alreadyHasHooks(body)) return src;

  // Find insertion point: after initial hook/const declarations block, but BEFORE early returns that use styles
  // Safest: insert right after opening brace (hooks must be unconditional)
  const insert = `\n  const colors = useColors();\n  const styles = useMemo(() => createStyles(colors), [colors]);\n`;
  return src.slice(0, braceOpen + 1) + insert + src.slice(braceOpen + 1);
}

function addHooksToAllComponents(src) {
  // Find all top-level function components (not createStyles)
  const re = /^(export\s+default\s+)?function\s+(\w+)\s*\(/gm;
  const matches = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[2];
    if (name === 'createStyles') continue;
    matches.push({ index: m.index, name });
  }
  // Process from end to start so indices stay valid
  for (let i = matches.length - 1; i >= 0; i--) {
    src = insertHooksInComponent(src, matches[i].index);
  }
  return src;
}

function convertFile(rel) {
  const p = path.join(root, rel);
  let src = fs.readFileSync(p, 'utf8');
  const original = src;

  // Special case: chat/_layout — no StyleSheet, just colors.bg
  if (rel.replace(/\\/g, '/') === '(tabs)/chat/_layout.tsx') {
    src = src.replace(
      /import\s*\{\s*colors\s*\}\s*from\s*['"]@\/constants\/theme['"]\s*;?\n?/,
      `import { useColors } from '@/context/ThemeContext';\n`,
    );
    if (!/const colors = useColors/.test(src)) {
      src = src.replace(
        /export default function ChatLayout\(\)\s*\{/,
        `export default function ChatLayout() {\n  const colors = useColors();`,
      );
    }
    if (src !== original) {
      fs.writeFileSync(p, src);
      return { file: rel, status: 'converted', note: 'layout useColors only' };
    }
    return { file: rel, status: 'skipped', note: 'already done' };
  }

  if (!/from ['"]@\/constants\/theme['"]/.test(src) && !/\bcolors\b/.test(src)) {
    return { file: rel, status: 'skipped', note: 'no theme colors' };
  }

  // Skip if already converted
  if (/function createStyles\(colors: AppColors\)/.test(src) && /useColors\(\)/.test(src)) {
    return { file: rel, status: 'skipped', note: 'already converted' };
  }

  src = updateThemeImport(src);
  src = ensureUseColorsImport(src);
  src = ensureUseMemo(src);
  src = wrapCreateStyles(src);
  src = addHooksToAllComponents(src);

  // Clean duplicate AppColors if we added both type AppColors incorrectly
  src = src.replace(
    /import\s*\{\s*type AppColors\s*,\s*type AppColors\s*\}\s*from/,
    `import { type AppColors } from`,
  );

  if (src === original) {
    return { file: rel, status: 'failed', note: 'no changes applied' };
  }

  fs.writeFileSync(p, src);
  return { file: rel, status: 'converted' };
}

const results = files.map(convertFile);
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.status === 'failed');
const converted = results.filter((r) => r.status === 'converted');
console.log(`\nConverted: ${converted.length}, Failed: ${failed.length}, Skipped: ${results.length - converted.length - failed.length}`);
