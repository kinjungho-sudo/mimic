function isDecorativeActionGlyph(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0;
  return (codePoint >= 0x2190 && codePoint <= 0x21ff)
    || (codePoint >= 0x2600 && codePoint <= 0x27bf)
    || (codePoint >= 0x2b00 && codePoint <= 0x2bff)
    || (codePoint >= 0x1f000 && codePoint <= 0x1faff);
}

/**
 * Removes decorative arrows and pictographs from captured action copy while
 * preserving the readable element label around them.
 */
export function stripDecorativeActionGlyphs(value: string | null | undefined): string {
  return Array.from(String(value ?? ''))
    .map(character => isDecorativeActionGlyph(character) ? ' ' : character)
    .join('')
    .replace(/[\uFE0E\uFE0F\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasDecorativeActionGlyph(value: string | null | undefined): boolean {
  const text = String(value ?? '').trim();
  return !!text && stripDecorativeActionGlyphs(text) !== text;
}
