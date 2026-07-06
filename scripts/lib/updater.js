// updater.js — 自更新机制（fire-and-forget，零阻塞）
// 每次 CLI 启动时后台检查远端版本，命中更新则向 stderr 输出一行黄字提示。
// SKILL.md 中"自更新协议"章节规定 Agent 看到该提示必须用 AskUserQuestion 询问用户。
//
// 设计原则：
// - 异步、不阻塞主流程；网络失败/超时一律静默
// - 24h TTL 缓存，避免每次调用都打网络
// - 支持 ICONPARK_NO_UPDATE_NOTIFY=1 一键关闭
// - 支持 ICONPARK_VERSION_URL 覆盖默认远端（测试用）

import { promises as fs, statSync, readFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execFile } from 'node:child_process';

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
    const md = readFileSync(path.join(SKILL_ROOT, 'SKILL.md'), 'utf8');
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

const ERROR_LOG = path.join(CACHE_DIR, 'last_error.json');

async function writeErrorLog(stage, err) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      ERROR_LOG,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          stage,
          message: err?.message || String(err),
          cause: err?.cause?.message,
        },
        null,
        2
      )
    );
  } catch {
    /* 写不进也不致命 */
  }
}

async function clearErrorLog() {
  try { await fs.unlink(ERROR_LOG); } catch { /* 文件可能不存在 */ }
}

async function fetchViaHttp() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(VERSION_URL, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'iconpark-skill/updater' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).trim();
    return text.split('\n')[0].trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback：用 git ls-remote 拿 HEAD commit hash 的短 7 位当版本号
 * 不是 semver，但至少能判断"远端 commit ≠ 本地 commit"
 */
async function fetchViaGit() {
  // 解析 VERSION_URL → 远端 git URL
  // 支持 https://raw.githubusercontent.com/owner/repo/branch/VERSION
  // 推导：https://github.com/owner/repo.git
  let gitUrl = null;
  try {
    const u = new URL(VERSION_URL);
    if (u.hostname === 'raw.githubusercontent.com') {
      const parts = u.pathname.split('/').filter(Boolean); // [owner, repo, branch, ...]
      if (parts.length >= 2) {
        gitUrl = `https://github.com/${parts[0]}/${parts[1]}.git`;
      }
    } else if (u.hostname === 'github.com' || u.hostname === 'gitlab.com') {
      gitUrl = u.toString();
    }
  } catch { /* URL 解析失败 */ }
  if (!gitUrl) return null;

  // 5s 超时（execFileSync 没 timeout，用 Promise.race）
  return await new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish(null), 5000);
    // 用 git 子进程异步取
    execFile('git', ['ls-remote', gitUrl, 'HEAD'], { timeout: 4500 }, (err, stdout) => {
      clearTimeout(timer);
      if (err) return finish(null);
      const m = stdout.match(/^([0-9a-f]{7,40})\s+HEAD/m);
      finish(m ? `git-${m[1].slice(0, 7)}` : null);
    });
  });
}

async function fetchRemoteVersion() {
  // 尝试 1: fetch VERSION 文件
  try {
    const v = await fetchViaHttp();
    if (v) return { version: v, source: 'http' };
  } catch (e) {
    await writeErrorLog('fetch-http', e);
  }
  // 尝试 2: git ls-remote fallback
  try {
    const v = await fetchViaGit();
    if (v) return { version: v, source: 'git' };
  } catch (e) {
    await writeErrorLog('fetch-git', e);
  }
  return null;
}

// ---------- 主入口：检查更新 ----------

/**
 * 检查更新。**改成同步等待**（最多 5s），避免 fire-and-forget 在快速命令下
 * 主进程退出时 IIFE 还没写完 stderr 导致提示丢失。
 * 实测 fetch 正常 200ms 完成，对主命令影响可接受。
 *
 * @param {string} [localVersion] - 本地版本号；不传则自动从 SKILL.md 解析
 * @returns {Promise<{updated: boolean, local: string, remote: string|null}>}
 */
export async function checkForUpdate(localVersion) {
  // 用户已永久关闭
  if (process.env.ICONPARK_NO_UPDATE_NOTIFY === '1') {
    return { updated: false, local: localVersion, remote: null, skipped: true };
  }

  const local = localVersion || parseLocalVersion();

  try {
    const cache = await readCache();
    const now = Date.now();
    let remote = cache?.remote;
    let source = cache?.source || 'cache';

    // 缓存未过期且有远端版本 → 直接复用
    const cacheValid = remote && now - (cache?.checked_at || 0) < TTL_MS;
    if (!cacheValid) {
      const fetched = await fetchRemoteVersion();
      if (fetched) {
        remote = fetched.version;
        source = fetched.source;
        await writeCache({ remote, source, checked_at: now, local });
        await clearErrorLog();
      } else {
        // fetch 失败：保留旧缓存不覆盖（避免用 24h 前的状态）
        return { updated: false, local, remote: null, error: true };
      }
    }

    const updated = remote && compareSemver(remote, local) > 0;
    if (updated) {
      // 关键：写到 stderr，主流程 stdout 不污染
      process.stderr.write(
        `\n\x1b[33m⚠ iconpark: 本地 v${local}，远端 v${remote}（${source}）。` +
          `运行 \x1b[1miconpark update\x1b[0m\x1b[33m 升级，` +
          `或设 ICONPARK_NO_UPDATE_NOTIFY=1 关闭提醒。\x1b[0m\n`
      );
    }
    return { updated, local, remote, source };
  } catch (e) {
    // 静默：网络/Cache/任何异常都不应阻塞主流程
    await writeErrorLog('check-main', e);
    return { updated: false, local, remote: null, error: true };
  }
}

// ---------- update 子命令：执行更新 ----------

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function copyDirSync(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      copyFileSync(s, d);
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