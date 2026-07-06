// updater.js — 自更新机制（fire-and-forget，零阻塞）
// 每次 CLI 启动时后台检查远端版本，命中更新则向 stderr 输出一行黄字提示。
// SKILL.md 中"自更新协议"章节规定 Agent 看到该提示必须用 AskUserQuestion 询问用户。
//
// 设计原则：
// - 异步、不阻塞主流程；网络失败/超时一律静默
// - 24h TTL 缓存，避免每次调用都打网络
// - 支持 ICONPARK_NO_UPDATE_NOTIFY=1 一键关闭
// - 支持 ICONPARK_VERSION_URL 覆盖默认远端（测试用）

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SKILL_ROOT = process.env.ICONPARK_SKILL_ROOT
  || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

const CACHE_DIR = path.join(os.homedir(), '.cache', 'iconpark');
const CACHE_FILE = path.join(CACHE_DIR, 'check.json');
const BACKUP_ROOT = path.join(CACHE_DIR, 'backups');
const TTL_MS = 24 * 60 * 60 * 1000;            // 24 小时
const FETCH_TIMEOUT_MS = 3000;                  // 3s 超时，宁可失败不阻塞

const DEFAULT_VERSION_URL =
  'https://raw.githubusercontent.com/YuWuChen82/iconpark-skill/main/VERSION';
const VERSION_URL = process.env.ICONPARK_VERSION_URL || DEFAULT_VERSION_URL;

// ---------- 工具函数 ----------

function parseLocalVersion() {
  // 从 SKILL.md 的 YAML frontmatter 里读 `version: x.y.z`
  try {
    const md = require('node:fs').readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
    const m = md.match(/^version:\s*(\S+)/m);
    return m ? m[1] : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function compareSemver(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function writeCache(data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {
    /* 缓存写不进也不致命 */
  }
}

async function fetchRemoteVersion() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(VERSION_URL, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'iconpark-skill/updater' },
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    // VERSION 文件可能就一行 "0.5.0"，也可能带 changelog（取首行）
    return text.split('\n')[0].trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 主入口：后台检查 ----------

/**
 * 后台检查更新。调用方不等结果，主命令立即继续。
 * 命中更新时向 stderr 输出黄字提示（SKILL.md 协议要求 Agent 询问用户）。
 *
 * @param {string} [localVersion] - 本地版本号；不传则自动从 SKILL.md 解析
 */
export function checkForUpdateBackground(localVersion) {
  // 用户已永久关闭
  if (process.env.ICONPARK_NO_UPDATE_NOTIFY === '1') return;

  const local = localVersion || parseLocalVersion();

  (async () => {
    try {
      const cache = await readCache();
      const now = Date.now();
      let remote = cache?.remote;

      // 缓存未过期且有远端版本 → 直接复用，不打网络
      const cacheValid = remote && now - (cache?.checked_at || 0) < TTL_MS;
      if (!cacheValid) {
        remote = await fetchRemoteVersion();
        if (remote) {
          await writeCache({ remote, checked_at: now, local });
        }
      }

      if (remote && compareSemver(remote, local) > 0) {
        // 关键：写到 stderr，主流程 stdout 不污染
        process.stderr.write(
          `\n\x1b[33m⚠ iconpark: 本地 v${local}，远端 v${remote}。` +
            `运行 \x1b[1miconpark update\x1b[0m\x1b[33m 升级，` +
            `或设 ICONPARK_NO_UPDATE_NOTIFY=1 关闭提醒。\x1b[0m\n`
        );
      }
    } catch {
      /* 静默：网络/Cache/任何异常都不应阻塞主流程 */
    }
  })();
}

// ---------- update 子命令：执行更新 ----------

function exists(p) {
  try {
    require('node:fs').statSync(p);
    return true;
  } catch {
    return false;
  }
}

function copyDirSync(src, dst) {
  require('node:fs').mkdirSync(dst, { recursive: true });
  for (const entry of require('node:fs').readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      require('node:fs').copyFileSync(s, d);
    }
  }
}

async function backupCurrent() {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14); // YYYYMMDDHHMMSS
  const backupDir = path.join(BACKUP_ROOT, `${ts}_iconpark`);
  await fs.mkdir(backupDir, { recursive: true });
  copyDirSync(SKILL_ROOT, backupDir);
  return backupDir;
}

/**
 * 升级方式：检测 SKILL_ROOT 是否在 git 仓库内，是 → git pull；否则 → 提示手动。
 */
export async function performUpdate() {
  const isGit = exists(path.join(SKILL_ROOT, '.git'));
  if (!isGit) {
    return {
      ok: false,
      message:
        '当前安装不是 git 仓库，无法自动升级。\n' +
        '请用 install.js 重装：\n' +
        '  curl -fsSL https://raw.githubusercontent.com/YuWuChen82/iconpark-skill/main/install.js | node\n' +
        `当前路径：${SKILL_ROOT}`,
    };
  }

  // 1) 备份
  const backupDir = await backupCurrent();

  // 2) git pull
  let pullErr = null;
  try {
    execFileSync('git', ['pull', '--ff-only'], {
      cwd: SKILL_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    pullErr = e.stderr ? e.stderr.toString() : e.message;
  }

  if (pullErr) {
    return {
      ok: false,
      message: `git pull 失败：${pullErr}\n已备份到：${backupDir}`,
    };
  }

  // 3) 校验新版本
  const newVersion = parseLocalVersion();
  const remoteCache = await readCache();
  const remote = remoteCache?.remote;

  if (remote && compareSemver(newVersion, remote) < 0) {
    return {
      ok: false,
      message: `升级后本地版本 v${newVersion} 仍低于远端 v${remote}，请检查网络或重试。\n已备份到：${backupDir}`,
    };
  }

  return {
    ok: true,
    message: `✓ 升级成功：v${parseLocalVersion()} → v${newVersion}\n旧版本备份：${backupDir}`,
    newVersion,
  };
}