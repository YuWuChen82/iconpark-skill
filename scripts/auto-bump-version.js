#!/usr/bin/env node
/**
 * scripts/auto-bump-version.js
 *
 * 自动 bump 版本号，跨平台 (macOS / Linux / Windows)，单脚本执行。
 *
 * 用法:
 *   node scripts/auto-bump-version.js                  # 默认 patch bump + auto commit
 *   node scripts/auto-bump-version.js --type minor     # bump minor (x.Y.0)
 *   node scripts/auto-bump-version.js --type major     # bump major (X.0.0)
 *   node scripts/auto-bump-version.js --dry-run        # 只算新版本号，不改文件
 *   node scripts/auto-bump-version.js --no-commit      # 只改文件，不 commit
 *   node scripts/auto-bump-version.js --skip-if-clean  # 上次 commit 已是 bump 或 working tree 有未提交改动 → 跳过
 *
 * 触发场景:
 *   - 用户在 Claude Code 里跑 `git push` → PreToolUse 钩子 (在 .claude/settings.json) 检测到，调用此脚本
 *   - 用户在终端里直接 `git push` → git pre-push hook 调用此脚本（需先跑 scripts/install-git-hooks.sh）
 *   - 手动 `node scripts/auto-bump-version.js`
 *
 * 三处同步更新:
 *   - VERSION             （顶层纯文本文件，自更新读这个）
 *   - SKILL.md frontmatter (`version: X.Y.Z`, YAML 内的第一行）
 *   - package.json        （`"version": "X.Y.Z"`）
 *
 * Commit 格式: `chore: bump v<X.Y.Z> → v<X.Y.Z+1>`，conventional commit
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const noCommit = args.includes('--no-commit');
const skipIfClean = args.includes('--skip-if-clean');

const typeIdx = args.indexOf('--type');
const type = (typeIdx !== -1 ? args[typeIdx + 1] : 'patch') || 'patch';

if (!['major', 'minor', 'patch'].includes(type)) {
  console.error(`❌ --type 必须是 major / minor / patch，当前: ${type}`);
  process.exit(1);
}

if (!existsSync('VERSION')) {
  console.error('❌ VERSION 文件不存在，请确认在仓库根目录运行');
  process.exit(1);
}

const current = readFileSync('VERSION', 'utf8').trim();
const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!m) {
  console.error(`❌ VERSION 内容格式不对: "${current}" (应为 X.Y.Z)`);
  process.exit(1);
}

const [, majorS, minorS, patchS] = m;
let major = +majorS, minor = +minorS, patch = +patchS;

let next;
switch (type) {
  case 'major': next = `${major + 1}.0.0`; break;
  case 'minor': next = `${major}.${minor + 1}.0`; break;
  case 'patch': next = `${major}.${minor}.${patch + 1}`; break;
}

// --skip-if-clean: 跳过的情况集中在这一步判断
if (skipIfClean) {
  try {
    // 1) 上一次 commit 已是 bump  → 跳过
    const lastMsg = execSync('git log -1 --pretty=%B 2>/dev/null', { encoding: 'utf8' }).trim();
    if (lastMsg.startsWith('chore: bump v')) {
      console.log(`⏭  跳过：上一次 commit 已是 bump (${lastMsg.split('\n')[0]})`);
      process.exit(0);
    }

    // 2) working tree 有未提交的 VERSION/SKILL.md/package.json 改动  → 跳过 (避免覆盖用户手改)
    const status = execSync('git status --porcelain VERSION SKILL.md package.json', { encoding: 'utf8' }).trim();
    if (status) {
      console.log(`⏭  跳过：VERSION / SKILL.md / package.json 有未提交改动:\n${status.split('\n').map(l => '   ' + l).join('\n')}`);
      process.exit(0);
    }

    // 3) git 不可用 / 不在 git 仓库 → 当作无版本控制，跌入"老办法"，强制 bump
  } catch (e) {
    // git 出错；继续走正常 bump 路径（不会让人 push 卡住）
  }
}

console.log(`🔖  ${current} → ${next}`);

if (dryRun) {
  console.log('(dry-run, 文件未改)');
  process.exit(0);
}

// 写 VERSION
writeFileSync('VERSION', next + '\n');

// 改 SKILL.md frontmatter 第一行 version
const mdPath = 'SKILL.md';
if (existsSync(mdPath)) {
  const md = readFileSync(mdPath, 'utf8');
  const updated = md.replace(/^version: [^\n]+/m, `version: ${next}`);
  if (updated !== md) writeFileSync(mdPath, updated);
}

// 改 package.json version
const pkgPath = 'package.json';
if (existsSync(pkgPath)) {
  const pkg = readFileSync(pkgPath, 'utf8');
  const updated = pkg.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`);
  if (updated !== pkg) writeFileSync(pkgPath, updated);
}

if (noCommit) {
  console.log('✓  文件已改，commit 跳过 (--no-commit)');
  process.exit(0);
}

// stage + commit
try {
  execSync('git add VERSION SKILL.md package.json', { stdio: 'pipe' });
} catch (e) {
  console.error('❌ git add 失败:', e.message);
  process.exit(1);
}

try {
  execSync(
    `git commit -m "chore: bump v${current} → v${next}" --no-verify`,
    { stdio: 'pipe' }
  );
  console.log(`✓ 提交: chore: bump v${current} → v${next}`);
} catch (e) {
  const stderr = (e.stderr || '').toString();
  if (stderr.includes('nothing to commit')) {
    console.log('⏭  没有改动可提交');
  } else {
    console.error('❌ git commit 失败:', e.message);
    process.exit(1);
  }
}

console.log(`✅  bump 完成: v${current} → v${next}`);
