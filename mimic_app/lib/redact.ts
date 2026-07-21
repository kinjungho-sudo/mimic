/**
 * Redacts sensitive information from user-generated text before storing it.
 * Targets: Korean resident registration numbers, phone numbers, passwords in context,
 * credit/debit card numbers, email addresses, and machine-issued identifiers/tokens.
 */

const PATTERNS: Array<{ re: RegExp; mask: string }> = [
  // Korean resident registration number: 000000-0000000
  { re: /\d{6}-[1-4]\d{6}/g, mask: '[주민등록번호]' },
  // Korean phone: 010-0000-0000 or 0100000000 or 010 0000 0000
  { re: /0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}/g, mask: '[연락처]' },
  // Credit/debit card: 16 digits optionally grouped by 4
  { re: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, mask: '[카드번호]' },
  // Password fields: "비밀번호: xxxx", "pw: xxxx", "password: xxxx", "패스워드: xxxx"
  { re: /(비밀번호|패스워드|password|pw)\s*[:=\s]\s*\S+/gi, mask: '[비밀번호]' },
  // Email addresses
  { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, mask: '[이메일]' },
  // Slack-style object IDs (app/channel/workspace/user IDs such as A0BGV8HKK5X)
  { re: /\b[ACDGWUTB][A-Z0-9]{8,}\b/g, mask: '[서비스 식별자]' },
  // UUIDs
  { re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, mask: '[식별자]' },
  // Common OAuth/API token prefixes
  { re: /\b(?:xox[baprs]-|xapp-|sk-|pk_)[a-zA-Z0-9_\-]{8,}\b/g, mask: '[보안 토큰]' },
  // Long mixed machine identifiers. Avoid masking ordinary words by requiring letters and digits.
  { re: /\b(?=[a-zA-Z0-9_-]{16,}\b)(?=[a-zA-Z0-9_-]*[a-zA-Z])(?=[a-zA-Z0-9_-]*\d)[a-zA-Z0-9_-]+\b/g, mask: '[식별자]' },
];

export function containsSensitiveText(text: string | null | undefined): boolean {
  if (!text) return false;
  return PATTERNS.some(({ re }) => {
    re.lastIndex = 0;
    const matched = re.test(text);
    re.lastIndex = 0;
    return matched;
  });
}

export function redactSensitive(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  let result = text;
  for (const { re, mask } of PATTERNS) {
    result = result.replace(re, mask);
  }
  return result;
}
