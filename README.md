# @yuwuchen/iconpark-skill

> IconPark 图标命名 + 分组推荐 —— 设计师 / Agent 双用，Node ≥22，零第三方依赖。

| | |
|---|---|
| 依赖 | Node ≥ 22；零第三方 |
| 完整规范 | [`SKILL.md`](./SKILL.md)（host agent 入口）|

---

## 🪄 团队安装：复制发给 Agent

```text
请安装 @yuwuchen/iconpark-skill:
  npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
  或: npx @yuwuchen/iconpark-skill --version
完成后报告: which iconpark + iconpark help 首行版本号。
```

可通过 [bnpm 网站](https://bnpm.byted.org/package/@yuwuchen/iconpark-skill) 搜索本包。

---

## 🚀 快速安装（个人）

```bash
npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
iconpark help
```

---

## 🛠 CLI 用法

```bash
iconpark check icons/foo.svg               # 彩色卡片
iconpark check icons/foo.svg --json        # JSON 含 confidence + needs_visual_verification
iconpark recommend 双星                     # 纯命名
iconpark recommend 闪光 常规线性             # 带辅分类
iconpark update                             # 升级（npm update -g）
iconpark help
```

退出码：`0` 通过 · `1` 有命名问题 · `2` confidence=low（仅 `--json` 模式）

---

## 🌐 兼容 Runtime

Claude Code · Codex CLI · OpenCode · Hermes · Gemini CLI · Cline / Roo Code · GitHub Copilot · 其它降级走纯文字编号列表。详见 [SKILL.md §一](./SKILL.md)。

---

## 📁 仓库结构

```
SKILL.md          主规范（host agent 入口）
scripts/
  iconpark.js     CLI 入口
  lib/            分类 / 命名 / 渲染 / SVG 读 / 模板 / 自更新 (6 子模块)
assets/
  goodcase/       31 个规范命名样例
  badcase/        13 个问题样例
```

---

## 🚢 发布（维护者参考）

```bash
npm run release:patch   # changelog → bump → git push → npm publish (bnpm)
```
