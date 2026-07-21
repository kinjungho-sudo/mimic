const HTML_TAG = /<[^>]*>/g;
const HTML_ENTITY: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeNumericEntity(code: string): string | null {
  const value = Number.parseInt(code.startsWith('#x') ? code.slice(2) : code.slice(1), code.startsWith('#x') ? 16 : 10);
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return null;
  return String.fromCodePoint(value);
}

export function plainImageAlt(value: string | null | undefined): string {
  return (value ?? '')
    .replace(HTML_TAG, ' ')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#')) return decodeNumericEntity(code.toLowerCase()) ?? entity;
      return HTML_ENTITY[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveImageAlt(
  customAlt: string | null | undefined,
  title: string | null | undefined,
  description?: string | null,
): string {
  const custom = plainImageAlt(customAlt);
  if (custom) return custom.slice(0, 500);

  const cleanTitle = plainImageAlt(title);
  const cleanDescription = plainImageAlt(description);
  if (cleanTitle && cleanDescription && cleanTitle !== cleanDescription) {
    return `${cleanTitle}. ${cleanDescription}`.slice(0, 500);
  }
  return (cleanTitle || cleanDescription || '단계 화면').slice(0, 500);
}
