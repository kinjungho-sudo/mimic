export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001';

export const MANUAL_DRAFT_MODEL =
  process.env.OPENAI_DRAFT_MODEL?.trim() || 'gpt-5.6-luna';
