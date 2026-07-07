// updater.js — 自更新机制（基于 bnpm, fire-and-forget，零阻塞）
// 每次 CLI 启动时后台检查 bnpm 远端版本，命中更新则向 stderr 输出一行黄字提示。
// SKILL.md 中"自更新协议"章节规定 Agent 看到该提示必须用 AskUserQuestion 询问用户。

import { promises as fs, statSync, readFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@yuwuchen/iconpark-skill';
const BNPM_REGISTRY = 'https://bnpm.byted.org/';

const SKILL_ROOT = process.env.ICONPARK_SKILL_ROOT
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const CACHE_DIR = path.join(os.homedir(), '.cache', 'iconpark');
const CACHE_FILE = path.join(CACHE_DIR, 'check.json');
const BACKUP_ROOT = path.join(CACHE_DIR, 'backups');
const TTL_MS = 24 * 60 * 60 * 1000;

const REGISTRY = process.env.ICONPARK_REGISTRY || BNPM_REGISTRY;
const PACKAGE = process.env.ICONPARK_PACKAGE_NAME || PACKAGE_NAME;

function parseLocalVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(SKILL_ROOT, 'package.json'), 'utf8')
    );
    return pkg.version || '0.0.0';
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
  try { return JSON.parse(await fs.readFile(CACHE_FILE, 'utf8')); }
  catch { return null; }
}

async function writeCache(data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch { /* 忽略 */ }
}

async function fetchRemoteVersion() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(
      `${REGISTRY}${PACKAGE.replace('/', '%2f')}`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'iconpark-skill/updater' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const version = body?.['dist-tags']?.latest;
    if (!version) throw new Error('no latest tag in registry response');
    return { version: String(version), source: 'npm' };
  } catch {
    // fallback: npm view CLI
    try {
      const { stdout } = await execFile(
        'npm',
        ['view', PACKAGE, 'version', '--registry', REGISTRY],
        { timeout: 4000 }
      );
      const v = (stdout || '').toString().trim();
      return v ? { version: v, source: 'npm-cli' } : null;
    } catch {
      return null;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate(localVersion) {
  if (process.env.ICONPARK_NO_UPDATE_NOTIFY === '1')
    return { updated: false, local: localVersion, remote: null, skipped: true };

  const local = localVersion || parseLocalVersion();
  try {
    const cache = await readCache();
    const now = Date.now();
    let remote = cache?.remote;
    const cacheValid = remote && now - (cache?.checked_at || 0) < TTL_MS;
    if (!cacheValid) {
      const fetched = await fetchRemoteVersion();
      if (fetched) {
        remote = fetched.version;
        await writeCache({ remote, checked_at: now, local });
      } else {
        return { updated: false, local, remote: null, error: true };
      }
    }

    const updated = remote && compareSemver(remote, local) > 0;
    if (updated) {
      process.stderr.write(
        `\n\x1b[33m⚠ iconpark: 本地 v${local}，远端 v${remote}。` +
        `运行 \x1b[1miconpark update\x1b[0m\x1b[33m 升级，` +
        `或设 ICONPARK_NO_UPDATE_NOTIFY=1 关闭提醒。\x1b[0m\n`
      );
    }
    return { updated, local, remote };
  } catch {
    return { updated: false, local, remote: null, error: true };
  }
}

function exists(p) { try { statSync(p); return true; } catch { return false; } }

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
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backupDir = path.join(BACKUP_ROOT, `${ts}_iconpark`);
  await fs.mkdir(backupDir, { recursive: true });
  copyDirSync(SKILL_ROOT, backupDir);
  return backupDir;
}

export async function performUpdate() {
  const backupDir = await backupCurrent();
  try {
    execFileSync(
      'npm',
      ['update', '-g', PACKAGE, '--registry', REGISTRY],
      { stdio: 'pipe' }
    );
    return {
      ok: true,
      message: `✓ 升级成功：v${parseLocalVersion()}\n旧版本已备份：${backupDir}`,
      newVersion: parseLocalVersion(),
    };
  } catch (e) {
    const detail = e.stderr ? e.stderr.toString() : e.message;
    return {
      ok: false,
      message:
        `npm update 失败：${detail}\n` +
        `已备份到：${backupDir}\n` +
        `可手动重试: npm update -g ${PACKAGE} --registry ${REGISTRY}`,
    };
  }
}
