#!/usr/bin/env node
// install.js — iconpark-skill 一行部署脚本
// 用法：curl -fsSL https://raw.githubusercontent.com/YuWuChen82/iconpark-skill/main/install.js | node
//   或：npx iconpark-skill install
//   或：git clone + node install.js
//
// 自动探测 runtime（Claude Code / Codex / Gemini / OpenCode）→ git clone → 软链 SKILL.md → 暴露 CLI

import { execFileSync, execFile } from 'node:child_process';
import { existsSync, mkdirSync, symlinkSync, statSync, readlinkSync, unlinkSync, rmSync, chmodSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

const REPO = 'https://github.com/YuWuChen82/iconpark-skill.git';
const REPO_BRANCH = 'main';
const INSTALL_DIR = path.join(os.homedir(), '.iconpark-skill');
const BIN_DIR = path.join(os.homedir(), '.local', 'bin');

const execFileP = promisify(execFile);

const RUNTIMES = [
  { name: 'Claude Code', check: () => existsSync(path.join(os.homedir(), '.claude')), skillsDir: () => path.join(os.homedir(), '.claude', 'skills') },
  { name: 'Codex CLI',   check: () => existsSync(path.join(os.homedir(), '.codex')),  skillsDir: () => path.join(os.homedir(), '.codex', 'skills') },
  { name: 'Gemini CLI',  check: () => existsSync(path.join(os.homedir(), '.gemini')), skillsDir: () => path.join(os.homedir(), '.gemini', 'skills') },
  { name: 'OpenCode',    check: () => existsSync(path.join(os.homedir(), '.opencode')), skillsDir: () => path.join(os.homedir(), '.opencode', 'skills') },
];

const C = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function log(level, msg) { console.error(`${level} ${msg}`); }
const info = (m) => log(C.cyan('ℹ'), m);
const ok   = (m) => log(C.green('✓'), m);
const warn = (m) => log(C.yellow('⚠'), m);
const fail = (m) => log(C.red('✗'), m);

async function detectRuntimes() {
  const found = [];
  for (const r of RUNTIMES) {
    if (r.check()) found.push(r);
  }
  return found;
}

async function ask(question, defaultYes = true) {
  // 优先读 env var（用于 CI/无人值守）
  if (process.env.ICONPARK_INSTALL_YES === '1') return true;
  if (process.env.ICONPARK_INSTALL_NO === '1') return false;
  // TTY 交互
  if (!process.stdin.isTTY) {
    warn(`非 TTY 模式：${question}（默认 ${defaultYes ? 'y' : 'n'}）`);
    return defaultYes;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(`${C.yellow('?')} ${question} [${defaultYes ? 'Y/n' : 'y/N'}] `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === '' ? defaultYes : a === 'y' || a === 'yes');
    });
  });
}

async function cloneOrPull() {
  if (existsSync(path.join(INSTALL_DIR, '.git'))) {
    info(`已检测到安装目录：${INSTALL_DIR}，执行 git pull`);
    try {
      const { stdout } = await execFileP('git', ['pull', '--ff-only'], { cwd: INSTALL_DIR });
      ok(`git pull 成功${stdout.trim() ? '\n  ' + stdout.trim().split('\n').join('\n  ') : ''}`);
    } catch (e) {
      fail(`git pull 失败：${e.message}`);
      info('尝试重新 clone…');
      rmSync(INSTALL_DIR, { recursive: true, force: true });
      await execFileP('git', ['clone', '--depth', '1', '-b', REPO_BRANCH, REPO, INSTALL_DIR]);
    }
  } else {
    info(`克隆仓库到：${INSTALL_DIR}`);
    await execFileP('git', ['clone', '--depth', '1', '-b', REPO_BRANCH, REPO, INSTALL_DIR]);
    ok('克隆成功');
  }
}

async function linkSkill(runtime) {
  const skillsDir = runtime.skillsDir();
  mkdirSync(skillsDir, { recursive: true });
  const link = path.join(skillsDir, 'iconpark');
  // 已存在软链 → 删了重建
  try {
    const lstat = statSync(link);
    if (lstat.isSymbolicLink()) {
      const target = readlinkSync(link);
      if (target === INSTALL_DIR) {
        ok(`${runtime.name}：已存在正确软链`);
        return;
      }
      unlinkSync(link);
    } else {
      // 是真目录 → 备份后删
      const backup = `${link}.bak.${Date.now()}`;
      warn(`${runtime.name}：检测到非软链的 iconpark 目录，备份为 ${path.basename(backup)}`);
      execFileSync('mv', [link, backup]);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  symlinkSync(INSTALL_DIR, link, 'dir');
  ok(`${runtime.name}：已软链 ${link} → ${INSTALL_DIR}`);
}

async function linkBin() {
  mkdirSync(BIN_DIR, { recursive: true });
  const target = path.join(INSTALL_DIR, 'scripts', 'iconpark.js');
  const link = path.join(BIN_DIR, 'iconpark');
  try {
    const cur = readlinkSync(link);
    if (cur === target) {
      ok(`CLI：已存在正确软链 ${link}`);
      return;
    }
    unlinkSync(link);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  symlinkSync(target, link);
  chmodSync(target, 0o755);  // 确保可执行
  ok(`CLI：已软链 ${link} → ${target}`);
}

async function checkPath() {
  const pathDirs = (process.env.PATH || '').split(':');
  if (pathDirs.includes(BIN_DIR)) {
    ok(`PATH：已包含 ${BIN_DIR}`);
    return;
  }
  warn(`PATH：不包含 ${BIN_DIR}，新终端需手动加入`);
  const shell = process.env.SHELL || '/bin/zsh';
  const rcFile = shell.endsWith('zsh') ? '.zshrc' : shell.endsWith('bash') ? '.bashrc' : '.profile';
  const rcPath = path.join(os.homedir(), rcFile);
  const exportLine = `\n# iconpark CLI\nexport PATH="$HOME/.local/bin:$PATH"\n`;
  if (existsSync(rcPath)) {
    const content = require('node:fs').readFileSync(rcPath, 'utf8');
    if (content.includes('.local/bin')) {
      info(`${rcFile} 已包含 .local/bin，跳过`);
      return;
    }
    if (await ask(`自动把 PATH 写入 ${rcFile}？`, true)) {
      require('node:fs').appendFileSync(rcPath, exportLine);
      ok(`已写入 ${rcFile}（新终端生效）`);
    } else {
      info(`手动添加：${C.cyan(`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/${rcFile}`)}`);
    }
  } else {
    info(`手动添加：${C.cyan(`echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/${rcFile}`)}`);
  }
}

async function showVersion() {
  try {
    const { stdout } = await execFileP('node', [path.join(INSTALL_DIR, 'scripts', 'iconpark.js'), 'help'], { encoding: 'utf8' });
    const m = stdout.match(/v\d+\.\d+\.\d+/);
    if (m) ok(`当前版本：${m[0]}`);
  } catch { /* ignore */ }
}

async function main() {
  console.error(C.bold('\n📦 iconpark-skill 安装器\n'));

  // 1. 探测 runtime
  const runtimes = await detectRuntimes();
  if (runtimes.length === 0) {
    warn('未检测到任何已知 AI runtime（~/.claude / ~/.codex / ~/.gemini / ~/.opencode）');
    warn('仍会克隆仓库并暴露 iconpark CLI；你之后手动放到任何 runtime 的 skills 目录都行');
  } else {
    info(`检测到 ${runtimes.length} 个 runtime：${runtimes.map(r => r.name).join(', ')}`);
  }

  // 2. Clone / pull
  await cloneOrPull();

  // 3. 软链到各 runtime skills
  for (const r of runtimes) {
    await linkSkill(r);
  }

  // 4. 软链 CLI 到 ~/.local/bin
  await linkBin();

  // 5. PATH 检查
  await checkPath();

  // 6. 显示版本
  await showVersion();

  console.error(C.green('\n✓ 安装完成！试试：'));
  console.error(C.cyan('  iconpark help'));
  console.error(C.cyan('  iconpark check <file.svg>'));
  console.error(C.gray('\n升级：以后再跑本脚本即可（自动 git pull）\n'));
}

main().catch((e) => {
  fail(`安装失败：${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
