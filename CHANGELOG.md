# Changelog

All notable changes to `iconpark-skill` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- 多 SVG 批量处理（v0.8+）
- goodcase/badcase 自动从设计师提交中学习（v0.9+）

---

## [0.6.0] - 2026-07-06

### Added
- 自更新机制健壮性升级：fetch 失败时降级到 `git ls-remote` 拿 HEAD commit hash 作版本号
- 错误日志写到 `~/.cache/iconpark/last_error.json`，含 stage/message/cause 方便排查
- SKILL.md "排查指南" 章节（5 步定位自更新问题）
- SKILL.md "v0.6.0 更新日志" 章节

### Fixed
- **ESM `require` 兼容 bug**：`scripts/lib/updater.js` 是 ESM 模块但用 `require('node:fs')`，
  在 ESM 下 `require` 未定义被 try/catch 吞掉，导致 `isGit` 永远 false，
  `iconpark update` 误报"当前安装不是 git 仓库"。改为顶层 `import { ... } from 'node:fs'`
- **快速命令下 stderr 丢失 bug**：`checkForUpdateBackground` 是 fire-and-forget，
  `help` 等几十毫秒就退出的命令会把 IIFE 砍掉，提示无法写完。
  改为 `await checkForUpdate()`，正常命令多 ~200ms（fetch），最坏 5s（fallback）
- `package.json` 版本号对齐到 0.5.0（之前停留在 0.3.0）

### Notes
- 无破坏性变更；现有用户升级无感

---

## [0.5.0] - 2026-07-06

### Added
- **自更新机制首次发布**（v0.5+ 每次使用自动检查更新）
  - `scripts/lib/updater.js` — 自更新模块
  - `iconpark update` 子命令（备份 → git pull → 校验）
  - `VERSION` 文件（远端版本源）
  - SKILL.md "## 十一、自更新协议" 章节
- 24h TTL 缓存（`~/.cache/iconpark/check.json`）
- 环境变量：`ICONPARK_NO_UPDATE_NOTIFY=1` / `ICONPARK_VERSION_URL`
- `iconpark` CLI 暴露（`scripts/iconpark.js`）

---

## 版本约定

- **MAJOR**：破坏性 API 变更（CLI 子命令改名、必选参数变化）
- **MINOR**：新功能或新子命令（向后兼容）
- **PATCH**：bug 修复、文案、依赖

## 仓库

- 源：https://github.com/YuWuChen82/iconpark-skill
- 安装：`curl -fsSL https://raw.githubusercontent.com/YuWuChen82/iconpark-skill/main/install.js | node`
- 升级：再跑 install.js 一次（自动 git pull）
