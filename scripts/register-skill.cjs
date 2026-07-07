#!/usr/bin/env node
/**
 * scripts/register-skill.cjs
 *
 * npm postinstall 钩子：把当前 npm 全局包软链到各 host agent 的 skills 目录。
 *
 * 支持的 runtime:
 *   - Claude Code:    ~/.claude/skills/iconpark
 *   - Codex CLI:      ~/.codex/skills/iconpark
 *   - Gemini CLI:     ~/.gemini/skills/iconpark
 *   - OpenCode:       ~/.opencode/skills/iconpark
 *   - 其他未检测到的 runtime: skip(不打分,不打错误)
 *
 * 行为:
 *   - runtime 已存在 iconpark 软链,目标一致 → 静默跳过
 *   - 软链指向别处 → unlink 重建
 *   - 目录存在但非软链 → 备份为 iconpark.bak.<时间戳> 后软链
 *   - 目录不存在 → mkdir + 软链
 *
 * 调用:
 *   node scripts/register-skill.cjs           # 自动按 RUNTIMES 探测
 *   node scripts/register-skill.cjs --unlink # 删除所有 skills 下的 iconpark 软链
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_NAME = 'iconpark';

const RUNTIMES = [
  { name: 'Claude Code', skillsDir: () => path.join(os.homedir(), '.claude', 'skills') },
  { name: 'Codex CLI',   skillsDir: () => path.join(os.homedir(), '.codex',  'skills') },
  { name: 'Gemini CLI',  skillsDir: () => path.join(os.homedir(), '.gemini', 'skills') },
  { name: 'OpenCode',    skillsDir: () => path.join(os.homedir(), '.opencode','skills') },
];

// 全局包的物理路径: ../node_modules/@yuwuchen/iconpark-skill/
const PKG_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const UNLINK = args.includes('--unlink');

function exists(p) { try { fs.statSync(p); return true; } catch { return false; } }
function isSymlink(p) { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } }
function linkTarget(p) { try { return fs.readlinkSync(p); } catch { return null; } }

function safeUnlink(p) { try { fs.unlinkSync(p); } catch { /* */ } }

function backupDir(dir) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backup = `${dir}.bak.${ts}`;
  try {
    fs.renameSync(dir, backup);
    console.log(`⚠  备份非软链目录: ${dir} → ${backup}`);
  } catch (e) {
    console.error(`✗  无法备份 ${dir}: ${e.message}`);
    return false;
  }
  return true;
}

function linkSkill(runtime) {
  const skillsDir = runtime.skillsDir();
  const linkPath = path.join(skillsDir, SKILL_NAME);

  if (UNLINK) {
    if (isSymlink(linkPath)) {
      safeUnlink(linkPath);
      console.log(`✓  [${runtime.name}] 已移除软链: ${linkPath}`);
    }
    return;
  }

  if (!exists(skillsDir)) {
    // runtime 没装,跳过,不报错
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // 已有软链且指向我们 → 静默
  if (isSymlink(linkPath) && linkTarget(linkPath) === PKG_DIR) {
    console.log(`✓  [${runtime.name}] 已注册: ${linkPath} → ${PKG_DIR}`);
    return;
  }

  // 软链指向别处 → 重建
  if (isSymlink(linkPath)) {
    safeUnlink(linkPath);
  }

  // 是真目录 → 备份再软链
  if (exists(linkPath)) {
    if (!backupDir(linkPath)) return;
  }

  try {
    fs.symlinkSync(PKG_DIR, linkPath, 'dir');
    console.log(`✓  [${runtime.name}] 已注册: ${linkPath} → ${PKG_DIR}`);
  } catch (e) {
    console.error(`✗  [${runtime.name}] 软链失败: ${e.message}`);
  }
}

(function main() {
  if (UNLINK) console.log('🗑  卸载所有 host runtime 下的 iconpark 软链');
  else console.log('🔗  注册 @yuwuchen/iconpark-skill 到 host runtime:');
  console.log('');

  for (const r of RUNTIMES) {
    try { linkSkill(r); }
    catch (e) { console.error(`✗  [${r.name}] ${e.message}`); }
  }

  console.log('');
  console.log(UNLINK ? '完成。' : '提示: 重新打开对应 host agent 让新 skill 被检测到。');
})();
