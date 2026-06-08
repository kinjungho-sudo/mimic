/**
 * Redacts sensitive information from user-generated text before storing it.
 * Targets: Korean resident registration numbers, phone numbers, passwords in context,
 * credit/debit card numbers, and email addresses.
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
];

export function redactSensitive(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  let result = text;
  for (const { re, mask } of PATTERNS) {
    result = result.replace(re, mask);
  }
  return result;
}
