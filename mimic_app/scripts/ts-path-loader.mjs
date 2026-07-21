import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) {
    return nextResolve(specifier, context);
  }

  const basePath = join(appRoot, specifier.slice(2));
  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, join(basePath, 'index.ts'), join(basePath, 'index.tsx')];
  const resolvedPath = candidates.find(existsSync);

  if (!resolvedPath) {
    return nextResolve(specifier, context);
  }

  return {
    url: pathToFileURL(resolvedPath).href,
    shortCircuit: true,
  };
}
