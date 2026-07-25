import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const catalogPath = new URL('../lib/i18n/extended-translations.ts', import.meta.url);
const dynamicPath = new URL('../lib/i18n/extended-dynamic-translations.ts', import.meta.url);

function parse(fileUrl) {
  const sourceText = fs.readFileSync(fileUrl, 'utf8');
  return ts.createSourceFile(
    fileUrl.pathname,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function findVariableInitializer(sourceFile, name) {
  let initializer;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        initializer = declaration.initializer;
      }
    }
  });
  assert.ok(initializer, `Missing ${name}`);
  return initializer;
}

function literalText(node, label) {
  assert.ok(
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node),
    `${label} must be a string literal`,
  );
  return node.text;
}

const koreanPattern = /[가-힣]/;
const replacementCharacterPattern = /\uFFFD/;
const suspiciousMojibakePattern = /(?:Ã.|Â.|â[\u0080-\u00BF]|ð[\u0080-\u00BF])/;

const catalogSource = parse(catalogPath);
const catalogInitializer = findVariableInitializer(
  catalogSource,
  'EXTENDED_ENGLISH_TRANSLATIONS',
);
assert.ok(ts.isObjectLiteralExpression(catalogInitializer), 'Static catalog must be an object');

const seenKeys = new Set();
for (const property of catalogInitializer.properties) {
  assert.ok(ts.isPropertyAssignment(property), 'Static catalog entries must be properties');
  const key = literalText(property.name, 'Static catalog key');
  const value = literalText(property.initializer, `Translation for ${key}`);
  assert.ok(key.trim(), 'Static catalog keys must not be empty');
  assert.ok(value.trim(), `Translation for ${key} must not be empty`);
  assert.ok(!seenKeys.has(key), `Duplicate static translation key: ${key}`);
  assert.doesNotMatch(value, koreanPattern, `English translation still contains Korean: ${key}`);
  assert.doesNotMatch(value, replacementCharacterPattern, `Invalid replacement character: ${key}`);
  assert.doesNotMatch(value, suspiciousMojibakePattern, `Possible mojibake: ${key}`);
  seenKeys.add(key);
}

const dynamicSource = parse(dynamicPath);
const dynamicInitializer = findVariableInitializer(
  dynamicSource,
  'EXTENDED_DYNAMIC_TRANSLATIONS',
);
assert.ok(ts.isArrayLiteralExpression(dynamicInitializer), 'Dynamic catalog must be an array');

const seenPatterns = new Set();
for (const [index, element] of dynamicInitializer.elements.entries()) {
  assert.ok(ts.isArrayLiteralExpression(element), `Dynamic entry ${index} must be a tuple`);
  assert.equal(element.elements.length, 2, `Dynamic entry ${index} must have two values`);

  const [regexpNode, replacementNode] = element.elements;
  assert.ok(ts.isNewExpression(regexpNode), `Dynamic entry ${index} must create RegExp`);
  assert.equal(regexpNode.expression.getText(dynamicSource), 'RegExp');
  assert.equal(regexpNode.arguments?.length, 1, `Dynamic entry ${index} must have one pattern`);

  const pattern = literalText(regexpNode.arguments[0], `Dynamic pattern ${index}`);
  const replacement = literalText(replacementNode, `Dynamic replacement ${index}`);
  assert.ok(!seenPatterns.has(pattern), `Duplicate dynamic pattern: ${pattern}`);
  assert.doesNotThrow(() => new RegExp(pattern), `Invalid dynamic regular expression: ${pattern}`);
  assert.doesNotMatch(
    replacement,
    koreanPattern,
    `English dynamic replacement still contains Korean: ${replacement}`,
  );
  assert.doesNotMatch(
    replacement,
    replacementCharacterPattern,
    `Invalid replacement character in dynamic translation: ${replacement}`,
  );
  assert.doesNotMatch(
    replacement,
    suspiciousMojibakePattern,
    `Possible mojibake in dynamic translation: ${replacement}`,
  );

  const captureCount = [...pattern.matchAll(/\((?!\?(?:[:=!<]))/g)].length;
  const references = [...replacement.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
  assert.ok(
    references.every((reference) => reference >= 1 && reference <= captureCount),
    `Dynamic replacement references a missing capture group: ${replacement}`,
  );
  seenPatterns.add(pattern);
}

console.log(
  `Extended i18n verified: ${seenKeys.size} static entries, ${seenPatterns.size} dynamic entries`,
);
