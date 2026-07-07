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
完成会做两件事:
  1. CLI 装到 PATH（iconpark help 可用）
  2. postinstall 自动软链到本机所有 host runtime 的 skills 目录
     (Claude Code / Codex CLI / Gemini CLI / OpenCode)
完成后报告: which iconpark + iconpark help 首行版本号。
```

可通过 [bnpm 网站](https://bnpm.byted.org/package/@yuwuchen/iconpark-skill) 搜索本包。

---

## 🚀 快速安装（个人）

```bash
npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
iconpark help
```

> 需要新建 terminal 才会刷新 PATH。安装完后**重启 host agent** 让新 skill 被加载到路由表。

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

## 🔗 手动注册（如果 postinstall 跑挂了）

```bash
ln -s "$(npm root -g)/@yuwuchen/iconpark-skill" ~/.claude/skills/iconpark
ln -s "$(npm root -g)/@yuwuchen/iconpark-skill" ~/.codex/skills/iconpark
ln -s "$(npm root -g)/@yuwuchen/iconpark-skill" ~/.gemini/skills/iconpark
ln -s "$(npm root -g)/@yuwuchen/iconpark-skill" ~/.opencode/skills/iconpark

# 反注册
node "$(npm root -g)/@yuwuchen/iconpark-skill/scripts/register-skill.cjs" --unlink
```

> 跳过软链也行——skill 在项目开发阶段可以**本地直跑**：把 `SKILL.md` 复制到 `~/.claude/skills/iconpark/SKILL.md`（不需要 npm），适合你改了 SKILL.md 想立刻测试的场景。

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
  register-skill.cjs   自动软链到 host runtime
assets/
  goodcase/       31 个规范命名样例
  badcase/        13 个问题样例
```

---

## 🚢 发布（维护者参考）

```bash
npm run release:patch   # changelog → bump → git push → npm publish (bnpm)
```
