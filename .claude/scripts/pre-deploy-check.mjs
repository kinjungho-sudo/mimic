#!/usr/bin/env node
// Hook script: reads stdin JSON from Claude Code PreToolUse event
// Blocks deployment and runs Claude API verification if command contains 'vercel' and '--prod'
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try {
    const parsed = JSON.parse(input);
    command = parsed?.tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }

  const isVercelProd = /vercel/.test(command) && /--prod/.test(command);
  if (!isVercelProd) process.exit(0);

  console.log('🔍 배포 전 Claude API 검증 중...');
  const result = spawnSync(
    process.execPath,
    [join(__dirname, 'verify-claude-api.mjs')],
    { stdio: 'inherit', cwd: process.cwd() }
  );

  if (result.status === 0) {
    console.log('✅ 검증 완료 — 배포를 진행합니다.');
    process.exit(0);
  } else {
    process.stdout.write(JSON.stringify({
      continue: false,
      stopReason: '배포 전 Claude API 검증 실패. ANTHROPIC_API_KEY 및 모델명을 확인하세요.',
    }));
    process.exit(0);
  }
});
