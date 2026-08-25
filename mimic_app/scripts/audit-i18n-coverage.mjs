import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const appRoot = path.resolve(import.meta.dirname, '..');
const sourceRoots = [
  path.join(appRoot, 'app'),
  path.join(appRoot, 'components'),
  path.join(appRoot, 'lib'),
];
const translationFiles = [
  path.join(appRoot, 'lib', 'i18n', 'ui-translations.ts'),
  path.join(appRoot, 'lib', 'i18n', 'help-translations.ts'),
  path.join(appRoot, 'lib', 'i18n', 'legal-translations.ts'),
  path.join(appRoot, 'lib', 'i18n', 'extended-translations.ts'),
  path.join(appRoot, 'lib', 'i18n', 'extended-dynamic-translations.ts'),
];
const excludedSegments = new Set(['i18n', '__tests__', 'test', 'tests']);
const koreanPattern = /[가-힣]/;

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || excludedSegments.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function collectTranslationContracts() {
  const exact = new Set();
  const patterns = [];

  for (const filename of translationFiles) {
    const source = fs.readFileSync(filename, 'utf8');
    const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    function visitExact(node) {
      if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.name)) {
        exact.add(normalize(node.name.text));
      }
      ts.forEachChild(node, visitExact);
    }

    function visitPattern(node) {
      if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
        const literal = node.getText(tree);
        const closingSlash = literal.lastIndexOf('/');
        if (closingSlash > 0) {
          const body = literal.slice(1, closingSlash);
          const flags = literal.slice(closingSlash + 1);
          try {
            patterns.push(new RegExp(body, flags));
          } catch {
            // TypeScript accepted the source; an audit-only parser failure should not hide exact coverage.
          }
        }
      }
      if (
        ts.isNewExpression(node)
        && ts.isIdentifier(node.expression)
        && node.expression.text === 'RegExp'
        && node.arguments?.length
        && ts.isStringLiteralLike(node.arguments[0])
      ) {
        try {
          patterns.push(new RegExp(node.arguments[0].text));
        } catch {
          // Ignore an audit-only parser failure and continue collecting other contracts.
        }
      }
      ts.forEachChild(node, visitPattern);
    }

    visitExact(tree);
    if (filename.endsWith('ui-translations.ts')) {
      function findDynamicTranslations(node) {
        if (
          ts.isVariableDeclaration(node)
          && ts.isIdentifier(node.name)
          && node.name.text === 'DYNAMIC_TRANSLATIONS'
          && node.initializer
        ) {
          visitPattern(node.initializer);
          return;
        }
        ts.forEachChild(node, findDynamicTranslations);
      }
      findDynamicTranslations(tree);
    } else if (filename.endsWith('extended-dynamic-translations.ts')) {
      visitPattern(tree);
    }
  }

  return { exact, patterns };
}

function isCovered(value, contracts) {
  const normalized = normalize(value);
  return contracts.exact.has(normalized) || contracts.patterns.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(normalized);
  });
}

function collectKoreanLiterals(filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const kind = filename.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  const found = [];

  function add(value, node, type) {
    const normalized = normalize(value);
    if (!normalized || !koreanPattern.test(normalized)) return;
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    found.push({
      file: path.relative(appRoot, filename).replaceAll('\\', '/'),
      line: position.line + 1,
      type,
      value: normalized,
    });
  }

  function sampleExpression(node) {
    const sourceText = node.getText(tree);
    if (/BRAND|brand|product/i.test(sourceText)) return 'Parro';
    if (/email/i.test(sourceText)) return 'name@example.com';
    if (/count|length|index|step|percent|total|current|number|size|day|minute|second/i.test(sourceText)) return '2';
    return 'Sample';
  }

  function renderTemplate(node, placeholders = false) {
    let value = node.head.text;
    node.templateSpans.forEach((span, index) => {
      value += placeholders ? `{{${index + 1}}}` : sampleExpression(span.expression);
      value += span.literal.text;
    });
    return value;
  }

  function renderConcatenation(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = renderConcatenation(node.left);
      const right = renderConcatenation(node.right);
      return left === null || right === null ? null : left + right;
    }
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isTemplateExpression(node)) return renderTemplate(node);
    if (ts.isNumericLiteral(node)) return node.text;
    return sampleExpression(node);
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      add(node.getText(tree), node, 'jsx-text');
    } else if (ts.isStringLiteralLike(node)) {
      add(node.text, node, 'string');
    } else if (ts.isTemplateExpression(node)) {
      add(renderTemplate(node, true), node, 'template-expression');
      add(node.head.text, node.head, 'template');
      for (const span of node.templateSpans) add(span.literal.text, span.literal, 'template');
    } else if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.PlusToken
      && !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const rendered = renderConcatenation(node);
      if (rendered !== null) add(rendered, node, 'concatenation');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return found;
}

const contracts = collectTranslationContracts();
const all = sourceRoots.flatMap(walkFiles).flatMap(collectKoreanLiterals);
const uncovered = all.filter(item => !isCovered(item.value, contracts));
const uniqueUncovered = [...new Map(uncovered.map(item => [item.value, item])).values()]
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const uiUncovered = uniqueUncovered.filter(item => (
  (
    (item.file.startsWith('app/') && !item.file.startsWith('app/api/'))
    || item.file.startsWith('components/')
  )
  && !item.value.startsWith('[Parro]')
  && !item.value.includes('<svg')
  && !item.value.trimStart().startsWith('/*')
));
const reported = process.argv.includes('--ui-strict') ? uiUncovered : uniqueUncovered;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({
    scannedFiles: new Set(all.map(item => item.file)).size,
    koreanOccurrences: all.length,
    exactTranslations: contracts.exact.size,
    uncoveredOccurrences: uncovered.length,
    uniqueUncovered: uniqueUncovered.length,
    uiUncovered: uiUncovered.length,
    items: reported,
  }, null, 2));
} else {
  console.log(`Scanned UI files: ${new Set(all.map(item => item.file)).size}`);
  console.log(`Korean literal occurrences: ${all.length}`);
  console.log(`Exact translation keys: ${contracts.exact.size}`);
  console.log(`Uncovered occurrences: ${uncovered.length}`);
  console.log(`Unique uncovered literals: ${uniqueUncovered.length}`);
  console.log(`User-interface uncovered literals: ${uiUncovered.length}`);
  for (const item of reported) {
    console.log(`${item.file}:${item.line} [${item.type}] ${item.value}`);
  }
}

if (process.argv.includes('--strict') && uniqueUncovered.length > 0) process.exitCode = 1;
if (process.argv.includes('--ui-strict') && uiUncovered.length > 0) process.exitCode = 1;
