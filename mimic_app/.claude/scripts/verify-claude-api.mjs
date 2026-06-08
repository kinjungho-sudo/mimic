#!/usr/bin/env node
// Pre-deploy verification: checks Claude API is reachable and returns valid JSON
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function verify() {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: '{"test":true} 를 그대로 반환해줘. JSON만, 마크다운 없이.',
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    JSON.parse(cleaned); // throws if invalid
    console.log('✓ Claude API OK');
    process.exit(0);
  } catch (err) {
    console.error('✗ Claude API verification failed:', err.message);
    process.exit(1);
  }
}

verify();
