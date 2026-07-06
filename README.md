# iconpark-skill

> IconPark 图标命名 + 分组推荐 —— 设计师 / Agent 双用，Node ≥18，零依赖。

| | |
|---|---|
| 版本 | v0.5.0 (dev: v0.6 样式后缀) |
| 依赖 | Node ≥ 18；零第三方 |
| License | 内部使用 |
| 完整规范 | [`SKILL.md`](./SKILL.md)（host agent 入口，~350 行）|

---

## 🪄 团队安装：复制发给 Agent

```text
请在你的 runtime 装 iconpark-skill:
  来源: https://github.com/YuWuChen82/iconpark-skill
  步骤:
    1) git clone 到 skill 目录（默认 ~/.claude/skills/iconpark，其它 runtime 自查）
    2) 跑 `node scripts/iconpark.js help` 验证能输出帮助文本
    3) 把 SKILL.md frontmatter 的触发词加进路由表
  完成后报告: 安装路径 + help 首行版本号。
```

> 触发词 / 硬约束 / 自更新协议等代理规则全部在 [SKILL.md](./SKILL.md)。

---

## 🚀 快速安装（个人）

```bash
git clone https://github.com/YuWuChen82/iconpark-skill.git ~/.claude/skills/iconpark
~/.claude/skills/iconpark/scripts/iconpark.js help
```

---

## 🛠 CLI 用法

```bash
iconpark check icons/foo.svg               # 彩色卡片
iconpark check icons/foo.svg --json        # JSON 含 confidence + needs_visual_verification
iconpark recommend 双星                     # 纯命名
iconpark recommend 闪光 常规线性             # 带辅分类
iconpark update                             # 升级（先备份再 git pull，失败自动回滚）
iconpark help
```

退出码：`0` 通过 · `1` 有命名问题 · `2` confidence=low（仅 `--json` 模式）

---

## 🌐 兼容 Runtime

Claude Code · Codex CLI · OpenCode · Hermes · Gemini CLI · Cline / Roo Code · GitHub Copilot · 其它降级走纯文字编号列表。详见 [SKILL.md §一](./SKILL.md)。

---

## 📁 仓库结构

```
SKILL.md          主规范（host agent 入口，~350 行）
scripts/
  iconpark.js     CLI 入口
  lib/            分类 / 命名 / 渲染 / SVG 读 / 模板 / 自更新 (6 子模块)
assets/
  goodcase/       32 个规范命名样例
  badcase/        13 个问题样例
references/
  test-prompts.json
```

---

## 🔄 更新

- `iconpark update` —— 备份到 `~/.cache/iconpark/backups/` 后 `git pull`，失败自动回滚
- `export ICONPARK_NO_UPDATE_NOTIFY=1` —— 永久关闭 stderr 提示
- `ICONPARK_VERSION_URL=<url>` —— 团队内网 fork 覆盖默认远端
