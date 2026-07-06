# iconpark-skill

> IconPark 图标命名 & 分组推荐 —— 给设计师 / Agent 用, 纯文本分析, 零第三方依赖。

| | |
|---|---|
| **版本** | v0.5.0 (dev: v0.6 样式定型用后缀) |
| **运行环境** | Node ≥ 18（CLI); 任意 Skills-compatible Agent（SKILL 流程) |
| **第三方依赖** | 无 |
| **License** | 内部使用 |
| **触发词** | `check SVG` / `推荐名字` / `选分组` / `该放哪个分类` / `命名不规范` / `jc-icon-` / `IconPark 上传` |

---

## 🪄 一句话给 Agent 装上（团队可直接复制粘贴）

发给任意 agent（LARK / Claude Code / Cursor / Codex / OpenCode / Hermes / Gemini CLI / 通用 Skills-compatible runtime），它会自己装:

```text
请在你的 runtime 装 iconpark-skill:
  来源: https://github.com/YuWuChen82/iconpark-skill
  步骤:
    1) git clone 该仓库到你的 skill 目录（默认 ~/.claude/skills/iconpark，其它 runtime 请自查位置）
    2) 跑 `node scripts/iconpark.js help` 验证能输出帮助文本
    3) 把 SKILL.md frontmatter 的触发词加进路由表
  完成后告诉我安装路径和 `node scripts/iconpark.js help` 的首行版本号。
```

> 完整提示词含前置检查 / 失败回滚 / 报告模板的版本见下「📋 给 Agent 看的」一节。

---

## 📋 给 Agent 看的（机器可读）

### 元数据

```yaml
name: iconpark
version: 0.5.0
runtime: Node >= 18 （仅 CLI 需要；host agent 不需要）
deps: 0 third-party
entry_cli: scripts/iconpark.js
entry_skill: SKILL.md
repo: https://github.com/YuWuChen82/iconpark-skill
```

### 触发词（中英）

zh: 检查 SVG | 推荐名字 | 给我个英文名 | 选分组 | 该放哪个分类 | 命名不规范 | 帮我 check | IconPark 上传
en-prefix: `jc-icon-` 前缀的 identifier 出现时

### 期望输出三件套（每次推荐都必出）

1. **候选名字** — 主推 1 + 备选 2，三栏表，详见 [SKILL.md §十](./SKILL.md)
2. **分组** — 主分类 36 选 1 + 辅分类 7 选 1（可空）
3. **置信度** — `high` / `medium` / `low`；`low` 时必须停下问设计师，禁止硬猜

### 硬约束（违反即视为错误）

- 用户沉默 ≠ 同意 —— 必须重弹选项，不得默认采用推荐（[§一原则 3](./SKILL.md)）
- 文件名带 `agent-`/`AI-`/`app-`/`首页-`/`二级页面-` 前缀或 `*-2026.svg` 年份后缀 → 必须清洗（[§四 badcase](./SKILL.md)）
- SVG 含 `<linearGradient>` / `<radialGradient>` → 名字加 `-gradient`（v0.6+）
- SVG 含 ≥2 个不同 `fill` 色值 → 名字加 `-multicolor`
- 文件名 `数据.svg` / `暂无内容.svg` / `消息通知.svg` 等中文泛词 → 不许猜形状，必须问

### 自更新协议

CLI 在 stderr 输出形如 `⚠ iconpark: 本地 v0.5.0，远端 v0.6.0` 的提示行时，**必须**用 host agent 原生多选项工具弹 4 选项:

| 选项 label | 说明 |
|---|---|
| 立即更新 (推荐) | 备份后升级，失败自动回滚 |
| 稍后提醒 | 静默继续本次流程，5 小时后再提醒 |
| 本次跳过 | 静默继续，下次启动再问 |
| 关闭提醒 | 永久关闭（可手动 `iconpark update`） |

> 严禁 git pull 绕过 skill 自带更新；严禁不询问直接升级。

---

## 👀 给人看的

### 解决什么问题

设计师上传 SVG 到 IconPark 时三件套最容易踩坑:

- 名字带业务前缀（`Agent点击-2026.svg`）/ 年份后缀 → 仓库一坨脏名
- 命名按"用途"而不是"形状"（`user-avatar-popup-2026`）→ 上传后找不到
- 不知道放 36 个分类里的哪个 → 反复修改

iconpark-skill 用 **8 渠道文本推断**（读 `<title>` / `<desc>` / `<g id>` / 注释 / `data-*` 属性等；**不做像素识别**）给出:

- 标准 `jc-icon-xxx` 命名（kebab-case，形状优先，同义多图标用 `-one` / `-two`）
- 主分类（36 选 1，11 高频类优先，见 [SKILL.md §六](./SKILL.md)）
- 辅分类（7 选 1，可空，颜色 / 样式信息走这里）
- 置信度（`low` 时停下问，避免硬猜）

### 适用场景

| 场景 | 操作 | 输出 |
|---|---|---|
| Figma 导出 SVG 想上传 | `iconpark check icons/my.svg` | 彩色卡片 |
| 纯命名（不传文件） | `iconpark recommend 双星` | 候选英文名 |
| 看结构化结果（CI 用） | `iconpark check icons/my.svg --json` | JSON 含 `confidence` + `needs_visual_verification` |
| 升级 | `iconpark update` | 自更新，先备份再 `git pull` |
| 静默关掉更新提示 | `export ICONPARK_NO_UPDATE_NOTIFY=1` | 不再 stderr 弹黄条 |

### 前置要求

- **运行时**：Node ≥ 18（仅 CLI 需要；host agent 不需要）
- **网络**：仅自更新时需要（检查新版本 / `git pull`）
- **磁盘**：< 1 MB（含 47 个 SVG goodcase / badcase + SKILL.md）
- **第三方依赖**：无（Node 原生 `fs` / `path`）

---

## 🚀 安装

### 个人 / 设计师

```bash
git clone https://github.com/YuWuChen82/iconpark-skill.git ~/.claude/skills/iconpark
~/.claude/skills/iconpark/scripts/iconpark.js help
```

> 其它 runtime 路径: Codex `~/.codex/skills/`, Hermes `~/.hermes/skills/`, Gemini `~/.gemini/skills/` —— 视实际而定。

### 团队自动化

见上「🪄 一句话给 Agent 装上」段。

### CI / 流水线

```bash
git clone --depth=1 https://github.com/YuWuChen82/iconpark-skill.git /opt/iconpark
node /opt/iconpark/scripts/iconpark.js check ./ui/icons/foo.svg --json
```

---

## 🛠 用法

### 作为 skill（host agent 看 SKILL.md 执行）

agent 读完 [SKILL.md](./SKILL.md) 后按 §二 七节点流程（A→B→F→C→D→E→G）执行，每个决策点弹 2-3 个选项强制等用户回应。

典型触发:

- `帮我 check 一下 icons/cursor.svg`
- `我想做一个双星图标，推荐个英文名`
- `这个应该归界面组件还是硬件？`

完整规范见 [SKILL.md](./SKILL.md)（约 350 行主入口文档）。

### 作为 CLI 工具

```bash
iconpark check icons/my-icon.svg              # 默认：彩色卡片
iconpark check icons/my-icon.svg --json       # 结构化 JSON
iconpark recommend 双星                        # 只取英文名
iconpark recommend 闪光 常规线性                # 带辅分类
iconpark update                                 # 升级（先备份再拉取）
iconpark help                                   # 帮助
```

退出码:

| code | 含义 |
|---|---|
| `0` | 通过 |
| `1` | 有 naming error |
| `2` | 仅 `--json` 模式：`confidence=low` 且 `needs_visual_verification=true` |

---

## 🌐 Runtime 兼容矩阵

iconpark-skill **runtime-neutral**，不绑定 Claude Code:

| Runtime | 弹选项工具 | 状态 |
|---|---|---|
| Claude Code | `AskUserQuestion` | ✅ |
| Codex CLI | `request_user_input` | ✅（需 `experimental_request_user_input=true`）|
| OpenCode | TUI `question` | ✅ |
| Hermes | `prompt_user` | ✅ |
| Gemini CLI | `request_user_input` | ✅（复用 Codex schema）|
| Cline / Roo Code | `ask_followup_question` | ✅ |
| GitHub Copilot | `ask_user` | ✅ |
| 其它无原生工具 runtime | 路径 B 纯文字编号列表 + 4 阶段轮询 | ✅ |

完整适配规范见 [SKILL.md §一](./SKILL.md)。

---

## 📁 仓库结构

```
iconpark-skill/
├── SKILL.md                # 主规范 (~350 行, host agent 入口)
├── README.md               # 本文件
├── VERSION                 # 版本号 (自更新读这个)
├── package.json            # npm 入口 + 依赖声明
├── scripts/
│   ├── iconpark.js         # CLI 主程序
│   └── lib/                # 拆分子模块
│       ├── category.js     # 分类决策树
│       ├── naming.js       # 中文 → 英文映射
│       ├── render.js       # 卡片渲染
│       ├── svg-metadata.js # 读 SVG 8 渠道文本
│       ├── template.js     # 输出模板
│       └── updater.js      # 自更新子命令
├── assets/
│   ├── goodcase/           # 32 个规范命名样例（中文名_英文名.svg）
│   └── badcase/            # 13 个问题样例（业务前缀 / 位置前缀 / 中文泛词等）
└── references/
    └── test-prompts.json   # 3 个内置测试 prompt（评估用）
```

---

## 🔄 版本 & 自更新

- 当前版本：见 [VERSION](./VERSION) 文件
- 自更新协议：[SKILL.md §十一](./SKILL.md)
- 升级流程：`iconpark update` → 自动备份到 `~/.cache/iconpark/backups/<时间戳>_iconpark/` → `git pull` → 失败自动回滚
- 静默关掉：`export ICONPARK_NO_UPDATE_NOTIFY=1` 或写入 `~/.cache/iconpark/check.json`
- 团队内网 fork 用 `ICONPARK_VERSION_URL=<url>` 覆盖默认远端

### 版本变更日志（精选）

| 版本 | 关键改动 |
|---|---|
| v0.5.0 | 自更新协议 |
| v0.6.0 (dev) | 样式定型用后缀（`-gradient` / `-multicolor` / `-brand`），见 [SKILL.md §三](./SKILL.md) |
| v0.5.0 之前 | 多 Runtime 适配 / Fallback 协议 / 7 节点弹选项流程等 11 轮优化（详见 git log）|

---

## 🤝 贡献

- 新增 **goodcase** SVG：命名 `中文名_英文名.svg` 放 `assets/goodcase/`，验证命名符合 §三 + 主分类落在 11 个高频类
- 上报 **badcase**：文件名 + 问题模式 + 修复动作，放 `assets/badcase/`
- 扩展中文 → 英文映射：见 `scripts/lib/naming.js`
- 跑评估：`node scripts/iconpark.js check assets/badcase/*.svg --json`，目标全部 `confidence=high`

PR / Issue 都欢迎。

---

## 📄 License

内部使用 —— 详见团队约定。当前未对外开源。
