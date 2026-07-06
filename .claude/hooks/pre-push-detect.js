#!/usr/bin/env node
/**
 * .claude/hooks/pre-push-detect.js
 *
 * Claude Code Bash tool 的 PreToolUse 钩子。
 * 检测命令字符串里是否有 `git push`，有则调用 auto-bump-version.js。
 *
 * 由 .claude/settings.json 的 hooks.PreToolUse 段调用。
 *
 * 输入来源:
 *   - 标准 Claude Code 默认用 stdin 喂 JSON (含 tool_input.command)
 *   - 部分版本/路径用环境变量 $CLAUDE_TOOL_INPUT
 *   - 两者都试以兼容
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function getInput() {
  const env = process.env.CLAUDE_TOOL_INPUT || process.env.CLAUDE_INPUT || '';
  if (env) return env;
  try {
    // stdin (Claude Code hook 默认走 stdin)
    return readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

const raw = getInput();

// 提取 command 字段 (兼容 JSON 包裹 + 纯字符串)
let cmd = raw;
try {
  const obj = JSON.parse(raw);
  if (obj && typeof obj.tool_input === 'object' && obj.tool_input.command) {
    cmd = obj.tool_input.command;
  } else if (obj && typeof obj.command === 'string') {
    cmd = obj.command;
  }
} catch (e) {
  // 不是 JSON，原样当字符串
}

if (!/git\s+push/.test(cmd)) {
  process.exit(0);
}

// 是 push 了 → bump
try {
  execSync('node scripts/auto-bump-version.js --skip-if-clean', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} catch (e) {
  // bump 失败也不让 push 卡住（让 push 正常进行，下一次再补 bump）
  console.error('⚠  auto-bump 失败:', e.message);
}

process.exit(0);
