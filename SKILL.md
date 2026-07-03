---
name: iconpark
version: 0.3.0
description: "Use when a designer is preparing an IconPark icon and needs help with naming or two-tier categorization. Given an SVG file or Chinese description, recommends a standard identifier name, a primary semantic category (one of 36 official IconPark categories), an optional color sub-category (one of 7). Learns from goodcase/badcase reference sets in `assets/goodcase/` and `assets/badcase/` directories. Runtime-neutral: works in Claude Code (AskUserQuestion), Codex CLI (request_user_input), OpenCode (TUI question), Hermes (prompt_user), Gemini CLI (request_user_input). Triggers: 'check SVG', '推荐名字', '选分组', '该放哪个分类', '命名不规范', 'jc-icon-', 'IconPark 上传'."
---

# IconPark 图标设计师助手

## 询问用户选择

> **核心问题**:host agent 在不同 agent 环境(Claude Code / Codex / Cline / Copilot / OpenCode 等)需要用对应工具让设计师做选择。本章是 **§🌐 强制约束 #2** 的落地执行层,按 Agent 能力分两路。

### 路径 A:有原生多选项工具(优先)

> ✅ **首选方案**:Agent 提供原生多选项工具时,host agent **必须**调用对应工具,这是 §🌐 强制约束 #2 的标准实现。

| Agent | 原生工具 | 启用方式 | 备注 |
|---|---|---|---|
| **Claude Code** | `AskUserQuestion` | 内置,直接调用 | 详见 §Claude Code 实现示例 |
| **Codex CLI** | `request_user_input` | 需在 `~/.codex/config.toml` 启用 `experimental_request_user_input = true` | 官方 commit `e0435af` 2026-06-05 合入;不启用就走路径 B |
| **Cline / Roo Code** | `ask_followup_question` | 内置 | VS Code 扩展生态,选项数组格式 |
| **GitHub Copilot** | `ask_user` | 内置 | GitHub Copilot Chat / Workspace |
| **OpenCode** | TUI 内置 `question` 工具 | 通过 `permissions.questions` 配置 | TUI 风格,host agent 在 YAML frontmatter 标 `tool: "question"` |
| **Hermes** | `prompt_user` | 内置 | 通用多选 prompt |
| **Gemini CLI** | `request_user_input` | 内置 | 复用 Codex 兼容 schema |

调用示例(各 agent 一段):

```js
// Claude Code
const shape = await AskUserQuestion({
  questions: [{
    question: "这个图标实际形状是什么?",
    header: "形状",
    options: [
      {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号"},
      {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
      {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"},
      {label: "其它形状", description: "告诉我具体形状"}
    ],
    multiSelect: false
  }]
})
```

```js
// Codex CLI(snake_case)
const shape = await tools.request_user_input({
  questions: [{
    question: "这个图标实际形状是什么?",
    header: "形状",
    options: [
      {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号"},
      {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
      {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"},
      {label: "其它形状", description: "告诉我具体形状"}
    ],
    multi_select: false
  }]
})
```

```js
// Cline / Roo Code
const shape = await ask_followup_question({
  question: "这个图标实际形状是什么?",
  options: [
    {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号", preview: "⚠️"},
    {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
    {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"},
    {label: "其它形状", description: "告诉我具体形状"}
  ]
})
```

```js
// GitHub Copilot
const shape = await ask_user({
  question: "这个图标实际形状是什么?",
  options: [
    "感叹号/警告三角 (推荐)",
    "水晶+感叹号",
    "机器人/人形",
    "其它形状"
  ]
})
```

```js
// OpenCode(TUI 风格,YAML frontmatter)
---
tool: question
description: 询问设计师选择
---
prompt: 这个图标实际形状是什么?
options:
  - 感叹号/警告三角 (推荐)
  - 水晶+感叹号
  - 机器人/人形
  - 其它形状
```

- 🛑 **强制约束**:host agent 加载本 skill 时**必须**识别当前 agent(从 `process.env` / agent metadata / 配置上下文),**只**调用该 agent 的原生工具。**禁止**"我跑在 Cline 也写 `AskUserQuestion`" —— 错位调用直接报错。
- ❌ **禁止绕过路径 A 走路径 B**:即使你"觉得路径 B 简单",原生工具可用时**必须**优先用。

### 路径 B:无原生工具(降级方案)

> 🔴 **降级条件**:Agent **没有** §路径 A 任何原生工具(例如 Codex CLI default 模式未启用 `experimental_request_user_input`、纯命令行 REPL Agent、IDE 内联聊天等)。此时 host agent **必须**走纯文字编号列表 + 强制等待协议。

#### B.1 输出格式(用编号列表提问)

```text
═══════════════════════════════════════
⏸  host agent 必须停在这里等设计师回应
═══════════════════════════════════════

[1] 感叹号/警告三角 (推荐)
    → 单纯警告符号
[2] 水晶+感叹号
    → AI 风格的水晶出错图标
[3] 机器人/人形
    → 类似表情的'困惑/失败'角色
[4] 其它形状
    → 告诉我具体形状

请回复 1 / 2 / 3 / 4 之一,或自由描述。

⚠️ host agent 输出到此为止 — 不要继续输出任何内容
   (包括"我先按 [1] 继续"等)
═══════════════════════════════════════
```

#### B.2 等待与重试协议

| 轮次 | host agent 行为 | 输出 |
|---|---|---|
| **第 1 轮** | 纯文字编号列表 + ⏸ 显式等待标识 | 见 B.1 |
| **第 2 轮**(用户没回应) | 重新输出 + "上一轮我在等你"提示 | 同 B.1 加注 |
| **第 3 轮**(还没回应) | 升级 + 显式退出选项 `0=跳过 / free=自由描述` | 同 B.1 加 `[0]` `[free]` |
| **第 4 轮:超时** | 报错 + 终止 + 提示切换到有原生工具的 agent | 流程中断 |

> 🛑 **强制约束**:**3 轮还没回应必须报超时**,**禁止** host agent 在 4 阶段自动"我推断用户沉默 = 同意主推"——这是**逃避决策**,违反 §🌐 强制约束 #3。

#### B.3 与路径 A 的关键差异

| 维度 | 路径 A(原生工具) | 路径 B(降级纯文字) |
|---|---|---|
| 工具调用 | ✅ 必须调 `AskUserQuestion` 等 | ❌ 不调工具,纯文字 |
| 等待机制 | 工具自动阻塞等用户 | 靠 ⏸ 标识 + 硬约束 |
| 重试协议 | 工具自带超时 | 4 阶段轮询 |
| 退出选项 | 工具提供"其它" | 显式 `[0]` `[free]` 编号 |
| 失败兜底 | 工具报错 host agent 看到 | 阶段 4 报超时终止 |

> 💡 **如何选择路径**:
> - host agent 启动时**先检查**当前 agent 有没有原生工具(查 §路径 A 表格)
> - **有 → 路径 A**(强制)
> - **没有 → 路径 B**(必须按 4 阶段轮询)
> - **不要混用**:有原生工具却走纯文字 = 违反 §🌐 强制约束 #2

## 📋 流程驱动的弹选项节点表(必须先预分析,再弹选项)

> **核心原则**:**弹选项不是孤立的"提问",而是流程节点的"决策点"** —— 每个流程节点都对应一个特定的弹选项模板:**先输出预分析卡片**(展示当前上下文)→ **再弹选项**(基于预分析结果给候选)→ **等设计师回应** → **再进下一步**。
>
> ❌ **反例**(干巴巴的弹):刚读完 SVG 直接弹"实际形状是什么?" → 设计师无上下文,无法判断
> ✅ **正确**(流程驱动):读完 SVG → 输出预分析卡片(badcase 命中 / 清洗结果 / SVG 实际形状) → 弹"这个形状对得上吗?" → 设计师基于预分析回答

### 节点总览(7 个流程节点)

| # | 节点 | 流程位置 | 弹选项模板 |
|---|---|---|---|
| A | 读 SVG 后预分析 | 步骤 2 后 / 步骤 3 前 | "我的预分析对得上吗?" |
| B | badcase 命中(业务前缀/位置/中文泛词) | 步骤 4 | "剥离前缀后 X 是什么?" |
| C | 命名歧义(中文 mapping 多候选) | 步骤 4 | "哪个英文名更贴?" |
| D | 主分类歧义 | 步骤 5 | "归到哪个主分类?" |
| E | 辅分类歧义(渐变/多色) | 步骤 6 | "辅分类选哪个?" |
| F | low 置信度 + needs_visual_verification | 步骤 3-4 | "实际形状是?" |
| G | 落库前最终确认 | 步骤 10 | "最终结果落库?" |

### 节点 A:读 SVG 后预分析(必弹)

> **触发**:**任何** SVG 文件被 `check` 命令处理后,在弹任何决策点之前**先弹这个**。
> **目的**:让设计师看到 host agent "读懂了什么",避免"读错文件还问东问西"。

#### A.1 预分析卡片(必输出,先于弹选项)

```text
═══════════════════════════════════════
📋 预分析卡片 — 读 SVG 后(节点 A)
═══════════════════════════════════════

项目          | 内容
文件          | /path/to/icon.svg
badcase 命中  | ✅/❌(具体类型)
清洗后        | (业务前缀/位置/年份已剥离后的内容)
SVG 实际形状  | (从 8 渠道推断:viewBox、g id、d 命令关键字等)
置信度        | high/medium/low
主分类预判    | 候选 1 (推荐) / 候选 2 / 候选 3
辅分类预判    | 候选 1 (推荐) / 候选 2 / 候选 3
═══════════════════════════════════════
```

#### A.2 弹选项(基于预分析)

```js
AskUserQuestion({
  questions: [{
    question: "我的预分析对得上你的预期吗?",
    header: "预分析确认",
    options: [
      {label: "完全对,按预分析继续 (推荐)", description: "命名/分类预判都接受,直接进入步骤 4"},
      {label: "形状预判有误", description: "我重新看 path/group 给你修正"},
      {label: "分类预判有误", description: "我看你心里有别的分类,告诉我"},
      {label: "我直接补充信息", description: "用自由文本告诉我关键信息"}
    ],
    multiSelect: false
  }]
})
```

#### A.3 设计师回应后下一步

| 回应 | 下一步 |
|---|---|
| 选"完全对" | 跳过形状确认,直接进入节点 C/D/E(命名/分类/辅分类) |
| 选"形状预判有误" | 进入节点 F(low 置信度问形状) |
| 选"分类预判有误" | 进入节点 D(主分类歧义) |
| 选"自由补充" | 解析设计师输入 → 重新进预分析 |

### 节点 B:badcase 命中(必弹)

> **触发**:命中 §修复模式速查 9 个失败模式任一 → 弹这个。

#### B.1 预分析卡片(已包含在节点 A 中,直接引用)

#### B.2 弹选项(基于 badcase 类型动态生成)

```js
// 业务前缀(agent-/AI-/app-)命中
AskUserQuestion({
  questions: [{
    question: "剥离 'agent-' 前缀后,实际是什么?",
    header: "前缀剥离",
    options: [
      {label: "是一个光标 (推荐)", description: "剥离后是 cursor/clicking"},
      {label: "是一个按钮", description: "剥离后是 button"},
      {label: "其它形状", description: "我补充具体形状"},
      {label: "前缀不是业务用的,保留", description: "就是叫 agent-xxx"}
    ],
    multiSelect: false
  }]
})

// 位置前缀(二级页面-/首页-/弹窗-)命中
AskUserQuestion({
  questions: [{
    question: "剥离 '二级页面-' 位置前缀后,实际是什么?",
    header: "位置剥离",
    options: [
      {label: "收起图标 (推荐)", description: "箭头向下"},
      {label: "展开图标", description: "箭头向右"},
      {label: "关闭图标", description: "X 符号"},
      {label: "其它", description: "我补充"}
    ],
    multiSelect: false
  }]
})

// 中文泛词(数据/暂无内容/消息通知)命中
AskUserQuestion({
  questions: [{
    question: "'数据' 是哪种图表?",
    header: "泛词问形状",
    options: [
      {label: "柱状图 (推荐)", description: "bar chart"},
      {label: "饼图", description: "pie chart"},
      {label: "折线图", description: "line chart"},
      {label: "表格", description: "table"}
    ],
    multiSelect: false
  }]
})
```

#### B.3 设计师回应后下一步

| 回应 | 下一步 |
|---|---|
| 选"是 X" | 用 X 命名 + 继续节点 C/D/E |
| 选"其它形状"+ 自由输入 | 用自由输入命名 |
| 选"前缀不是业务用的,保留" | 警告一次 → 仍按保留命名 + low 置信度 |

### 节点 C:命名歧义(主推 1 + 备选 2-3,必弹)

> **触发**:中文 mapping 表返回 ≥ 2 个有效候选(例如「闪光」→ `flash` / `sparkle` / `twinkle`)。
> **目的**:给设计师 3-4 个英文候选选一个,而不是 host agent 自己挑。

#### C.1 弹选项

```js
AskUserQuestion({
  questions: [{
    question: "「闪光」图标,推荐哪个英文名?",
    header: "命名",
    options: [
      {label: "jc-icon-sparkle (推荐)", description: "最常用,IconPark 主流命名"},
      {label: "jc-icon-flash", description: "强调瞬间效果"},
      {label: "jc-icon-twinkle", description: "强调闪烁感"},
      {label: "我自己起一个", description: "用 free 自由输入"}
    ],
    multiSelect: false
  }]
})
```

#### C.2 设计师回应后下一步

| 回应 | 下一步 |
|---|---|
| 选候选 | 命名确定,进入节点 D(主分类) |
| 选"我自己起" + 自由输入 | 用自由输入作为 identifier(校验通过后) |

### 节点 D:主分类歧义(主推 1 + 备选 2-3,必弹)

> **触发**:分类决策树命中 ≥ 2 个分类关键词(例如「开关」同时命中"硬件"和"界面组件")。
> **目的**:让设计师在 3-4 个候选分类中选一个。

#### D.1 弹选项

```js
AskUserQuestion({
  questions: [{
    question: "「开关」图标应该归到哪个主分类?",
    header: "主分类",
    options: [
      {label: "硬件 (推荐)", description: "物理开关感,IconPark 原始归类"},
      {label: "界面组件", description: "UI 上的开关按钮"},
      {label: "符号标识", description: "通用 on/off 符号"},
      {label: "其它分类", description: "用 free 告诉我"}
    ],
    multiSelect: false
  }]
})
```

### 节点 E:辅分类歧义(SVG 含渐变/多色时必弹)

> **触发**:SVG 内含 `linearGradient` / `radialGradient` / 多个 fill 颜色 → 命中 §辅分类候选"渐变色"/"定色(多色)"。

#### E.1 弹选项

```js
AskUserQuestion({
  questions: [{
    question: "辅分类选哪个?",
    header: "辅分类",
    options: [
      {label: "渐变色 (推荐)", description: "保留现有 linearGradient/radialGradient"},
      {label: "定色(多色)", description: "渐变替换为具体色值 #28FFEF 等"},
      {label: "常规线性", description: "去掉渐变,改单色描边"},
      {label: "跳过(可空)", description: "本图标不需要辅分类"}
    ],
    multiSelect: false
  }]
})
```

### 节点 F:low 置信度 + needs_visual_verification(必弹)

> **触发**:`confidence=low` 且 `needs_visual_verification=true` → 弹这个。
> **目的**:Skill 不做视觉识别,必须问设计师"实际形状"。

#### F.1 弹选项

```js
AskUserQuestion({
  questions: [{
    question: "这个图标实际是什么形状?",
    header: "实际形状",
    options: [
      {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号"},
      {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
      {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"},
      {label: "其它形状", description: "用 free 告诉我具体形状"}
    ],
    multiSelect: false
  }]
})
```

### 节点 G:落库前最终确认(必弹)

> **触发**:步骤 8-9 完成,准备输出最终 `jc-icon-xxx` 写入 IconPark 后台**前**。
> **目的**:最后一道防错,避免把错的 identifier 推进 IconPark。

#### G.1 最终卡片(必输出,先于弹选项)

```text
═══════════════════════════════════════
✅ 最终结果(待确认)
═══════════════════════════════════════

identifier : jc-icon-sparkle
主分类     : 界面组件
辅分类     : 渐变色
置信度     : high
依据       : SVG <title>「闪光」命中 ZH_MAPPING,viewBox 24×24 含 radialGradient

📋 复制粘贴文本:
jc-icon-sparkle · 界面组件 · 渐变色
═══════════════════════════════════════
```

#### G.2 弹选项

```js
AskUserQuestion({
  questions: [{
    question: "最终结果确认落库?",
    header: "最终确认",
    options: [
      {label: "确认落库 (推荐)", description: "复制粘贴文本后写入 IconPark 后台"},
      {label: "改命名", description: "回节点 C 重新选"},
      {label: "改分类", description: "回节点 D 重新选"},
      {label: "暂停(我不确定)", description: "暂存草稿,稍后再看"}
    ],
    multiSelect: false
  }]
})
```

### 7 节点串联(完整流程)

```
步骤 2 读 SVG (8 渠道)
  ↓
【节点 A】输出预分析卡片 → 弹"预分析对得上吗?" → 等回应
  ↓
【节点 B】badcase 命中? → 是 → 弹"剥离后 X 是什么?" → 等回应
  ↓
【节点 F】low 置信度? → 是 → 弹"实际形状是?" → 等回应
  ↓
【节点 C】命名歧义? → 是 → 弹"哪个英文名?" → 等回应
  ↓
【节点 D】主分类歧义? → 是 → 弹"归到哪个分类?" → 等回应
  ↓
【节点 E】辅分类歧义? → 是 → 弹"辅分类选哪个?" → 等回应
  ↓
【节点 G】最终卡片 → 弹"确认落库?" → 等回应
  ↓
落库
```

> 🛑 **强制约束**:
> 1. **任何节点都不能跳过"先预分析"** — 没预分析就弹选项 = 干巴巴谈,违反本章原则
> 2. **任何节点都不能"自己挑了"** — 即使觉得 100% 确定,也要弹让设计师确认(对应 §🌐 强制约束 #3)
> 3. **节点触发不是互斥的** — 一次流程可能触发 A → B → F → C 多个节点
> 4. **每个节点独立等回应** — A 回应后才进 B,B 回应后才进 F,以此类推

## 🌐 强制约束（host agent 必须遵守）

> 这两条是**最高优先级**规则,凌驾于下文所有工作流之上 ——违反任一条 = 执行失败。

### 1. 中文输出(runtime-neutral)

- ✅ **所有 host agent 输出必须中文**:命名推荐、分类理由、置信度说明、检查点问题、修复提示、卡片文案、错误信息。
- ✅ 例外:**identifier 英文名本身**(`jc-icon-cursor` / `jc-icon-search` 等)和**代码块**保持英文(代码天然是英文)。
- ❌ 禁止:把推荐理由、问设计师的问题、置信度说明写成英文再让设计师"自己脑补中文"。
- 实现细节:`AskUserQuestion` 的 `question` / `header` / `options.label` / `options.description` 全部中文。

### 2. 必须弹选项,禁止纯文字自问自答(runtime-neutral)

- ✅ **任何需要设计师决策的点都必须用多选项交互工具弹出 2-4 个互斥选项**,系统会自动提供"其它"兜底(允许自由输入)。
- ✅ 选项设计原则:
  - **2-4 个互斥选项**(命名/分类推荐时**至少 2-3 个候选**,避免只给 1 个让设计师无选择)
  - 推荐项在 label 末尾加"(推荐)"
  - 每次只问 1 个 question(多 question 堆一起违反 §3 多轮动态问题规则)
- ❌ 禁止:**"请问您想要什么?"** / **"请告诉我您的偏好"** 这种开放式纯文字问法 —— 设计师认知负担重,响应慢。
- ❌ 禁止:代设计师直接做决定(比如"我推断是 X,继续")而不给选项。
- 🔴 **CHECKPOINT — 弹选项触发条件**:low 置信度 / badcase 命中 / 业务前缀 / 中文泛词 / 颜色冲突 / 分类歧义,任一命中**必须弹**。
- 📖 **具体实现按 Agent 走两路**(详见 §询问用户选择 章节):
  - **路径 A**:有原生工具(Claude Code / Codex / Cline / Copilot / OpenCode / Hermes / Gemini CLI)→ 调对应 API
  - **路径 B**:无原生工具(降级)→ 纯文字编号列表 + 4 阶段轮询 + 超时报错

### 3. 必须等用户选,未选=未完成(runtime-neutral)

> **🛑 最高优先级**:这条是上面 #2 的"执行闭环"补丁 —— 弹完选项只是**第 1 步**,拿到用户回应才算**第 2 步**。

- ✅ **弹完选项后必须停下来等用户回应**,host agent **禁止**自顾自继续往下走(比如"我先按主推继续,稍后改")。
- ✅ **禁止"默认采用主推"**:即使主推项 label 写了"(推荐)",host agent **也必须等用户明确点击/选择**,不能自动按主推当作用户的答案。
- ✅ **步骤完成的判定标准**:
  - ❌ host agent 自己给候选 = 步骤**进行中**
  - ✅ 拿到用户回应(选了/选"其它"+ 自由输入) = 步骤**完成**
- ✅ **多轮动态问题**的特殊处理:每轮弹完选项 → 等用户 → 拿到回应 → 才决定是否进入下一轮。**禁止"我先问 4 个问题,用户一次性答完"**(违反 §🔴 多轮动态问题规则)。
- ❌ 禁止:"我先按主推执行,设计师不同意再改" — 这等于剥夺了设计师决策权。
- ❌ 禁止:"设计师不说话就当默认同意" — 沉默 ≠ 同意,必须拿到显式回应。
- 🔴 **CHECKPOINT — "未回应" 失败模式**:host agent 弹完选项后,若用户没回应(沉默/跳过/只读不回),**必须**在下一轮对话中**重新弹**相同选项,而不是默认采用主推或继续往下走。

### 决策示例(对照表)

| 场景 | ❌ 错误(纯文字) | ✅ 正确(弹选项) |
|---|---|---|
| low 置信度问形状 | "请描述一下这个图标实际长什么样" | `AskUserQuestion({question: "这个图标实际是什么形状?", options: [{label: "感叹号/警告三角 (推荐)"}, ...]})` |
| 选辅分类 | "这个图标用常规线性还是渐变色?" | `AskUserQuestion({question: "辅分类选哪个?", options: [{label: "常规线性 (推荐)"}, {label: "渐变色"}, {label: "定色"}]})` |
| 命名有歧义 | "我觉得叫 jc-icon-search,你同意吗?" | `AskUserQuestion({question: "推荐名你接受哪个?", options: [{label: "jc-icon-search (推荐)"}, {label: "jc-icon-magnifier"}, {label: "jc-icon-zoom"}]})` |
| **host agent 默认采用主推** | "我先按 jc-icon-search 执行,你不同意再改" 或 弹完选项就自顾自继续 | 弹完选项 → **停下来** → 等用户点击/选择 → 拿到回应后**才**进入下一步 |
| **用户沉默/不回应** | "你不说话我默认按主推走" 或 自顾自跳过本步 | **重新弹**相同选项,直到拿到显式回应(沉默 ≠ 同意) |


## Step-by-Step 设计师交互流程

**host agent 必须按此顺序执行**(每步都有显式输出):

1. **收输入** — 设计师给 SVG 路径 或 中文描述(可两者)
2. **读 SVG** — 解析以下 **8 类渠道** 全量提取文本/结构信号(详见 §📖 步骤 2 读 SVG 8 渠道清单),让 host agent 通过**多渠道文本/结构**而非 path 像素推断形状
3. **算置信度** — `high` / `medium` / `low`(基于 metadata 完整度)
4. **取名字** — 命中 `assets/goodcase/` 风格 → 输出 **主推 1 个** + **备选 2-3 个** `jc-icon-<kebab-case>`;命中 `assets/badcase/` 模式 → 走"剥离业务前缀/剥年份/问形状"流程,候选同样给 2-3 个
5. **选主分类** — 从 36 官方语义分类(优先 11 高频 + goodcase 分布)**主推 1 个 + 备选 2-3 个**(共 3-4 个候选,让设计师选)
6. **选辅分类** — 从 7 色彩/样式分类(可空)**主推 1 个 + 备选 2-3 个**(仅 1 个候选违反本条)
7. **🛑 必须等用户选** — 弹完选项后**必须停下来等用户回应**(违反 §🌐 强制约束 #3)。`host agent 自己给候选 ≠ 步骤完成`,必须**拿到用户回应后才算完成**。
8. **输出卡片** — 命名 + 主分类 + 辅分类 + 复制粘贴文本(卡片是"待确认草稿",不是"已采纳结果")
9. **触发检查点** — `low` 置信度 / badcase 命中 / 业务前缀 → 🔴 必须用"多轮动态问题"问设计师(见下节)
10. **落库** — 设计师确认后输出最终 `jc-icon-xxx` 写入 IconPark 后台

## 📖 步骤 2 读 SVG 8 渠道清单(让 host agent 多渠道推断形状)

> **核心原则**:**不靠 path 像素识别**视觉形状(违反 §🛑 STOP 红线 #1),但**全量解析**下面 8 类渠道,让 host agent 通过文本/结构信号**推断** icon 形状、命名、分类。每多 1 个渠道命中,置信度 +1 级。

### 渠道 1:标准 SVG metadata

```xml
<svg>
  <title>双星</title>           <!-- 优先级最高:中文名 -->
  <desc>两颗叠加的星星</desc>    <!-- 形状描述 -->
  <metadata>...</metadata>       <!-- 通用元数据 -->
</svg>
```

- ✅ `<title>` = **最优先**,直接当中文名输入
- ✅ `<desc>` = 形状描述,辅助推断
- ❌ 禁止:跳过 `<title>` 直接用文件名

### 渠道 2:data-* 自定义属性(Figma/Sketch/IconPark 导出常见)

```xml
<svg data-name="双星" data-zh="双星" data-en="star-double" data-icon-name="jc-icon-star" data-category="界面组件">
```

- ✅ `data-name` / `data-zh` = 中文名
- ✅ `data-en` = 英文名候选
- ✅ `data-icon-name` = 已存在的 identifier(直接采纳)
- ✅ `data-category` = 主分类(直接采纳)
- ❌ 禁止:只解析 `data-name` 就停,其他 data-* 字段全部丢失

### 渠道 3:全部注释(设计师/工具的"隐藏信息")

```xml
<!-- Component: 双星图标 -->
<!-- Layer: 星形-大 -->
<!-- Layer: 星形-小 -->
<!-- Generator: Figma -->
<!-- Group: 界面组件/收藏 -->
```

- ✅ **强制解析所有 `<!-- xxx -->` 注释**(包括 Figma 导出的"组件名/图层名/分组")
- ✅ 中文图层名(`星形-大`)拼起来当形状描述
- ✅ `Generator: Figma` 提示导出工具,Figma 注释通常含中文
- ❌ 禁止:跳过注释只读 attribute

### 渠道 4:无障碍属性(aria)

```xml
<svg role="img" aria-label="双星图标" aria-labelledby="title-id">
```

- ✅ `aria-label` = 中文名(辅助 <title> 缺失场景)
- ✅ `role="img"` 标识这是图标(非装饰元素)

### 渠道 5:命名空间属性(Inkscape/Figma 插件导出)

```xml
<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:figma="http://www.figma.com/figma/ns"
     inkscape:label="双星"
     sodipodi:role="主图标"
     figma:node-id="1:23">
```

- ✅ `inkscape:label` / `sodipodi:role` = Inkscape 导出时的中文标签
- ✅ `figma:node-id` = Figma 节点 ID(辅助追溯)
- ❌ 禁止:忽略命名空间属性,只读标准 SVG 属性

### 渠道 6:group 分组 + transform(复合图标结构)

```xml
<g id="star-large" transform="rotate(15 24 24)">
  <path d="M24 4 L29 19 L44 19 L32 28 L37 43 L24 34 L11 43 L16 28 L4 19 L19 19 Z"/>
</g>
<g id="star-small" transform="translate(30 30) scale(0.5)">
  <path d="..."/>
</g>
```

- ✅ 每个 `<g id="xxx">` = 一个子元素,`id` 常含中文(设计软件导出习惯)
- ✅ `transform` 含 `rotate(N)` 提示图标有旋转(星/箭头/雪花等)
- ✅ `scale(N)` 提示子元素大小比例(双星 = 一大一小)

### 渠道 7:defs/symbol/use(IconPark 风格复合图标)

```xml
<defs>
  <symbol id="icon-star" viewBox="0 0 48 48">
    <path d="M24 4 L29 19 L44 19 L32 28 ..."/>
  </symbol>
</defs>
<use href="#icon-star"/>
```

- ✅ `<symbol id="icon-xxx">` 的 `id` = icon 名称(IconPark 标准做法)
- ✅ `<use href="#xxx">` 引用 symbol,推断"组合图标"

### 渠道 8:path d 命令关键字(几何特征,非像素识别)

> ⚠️ **不靠 d 数据猜形状**(违反 STOP 红线),但**统计 d 中的命令关键字**作为形状复杂度的辅助信号。

```xml
<path d="M24 4 A20 20 0 1 1 24 44 A20 20 0 1 1 24 4 Z"/>   <!-- 圆 -->
<path d="M24 4 L44 24 L24 44 L4 24 Z"/>                      <!-- 菱形 -->
<path d="M24 4 L29 19 L44 19 L32 28 L37 43 L24 34 L11 43 L16 28 L4 19 L19 19 Z"/>  <!-- 星 -->
```

| d 命令关键字 | 几何特征 | 可能形状(仅信号,非定论) |
|---|---|---|
| `A` 出现 ≥ 2 | 圆弧 | 圆/椭圆/圆角矩形 |
| `L` 连续 ≥ 3 个 | 直线段 | 多边形(三角/方/菱/星) |
| `C` 出现 ≥ 1 | 贝塞尔曲线 | 有机形状(云/水滴/心) |
| `Q` 出现 ≥ 1 | 二次曲线 | 平滑曲线(弧/钩) |
| `Z` 出现 ≥ 1 | 闭合 | 完整图形 |

- ✅ 用于"辅分类"判断(纯 L+Z = 折线图标 → 常规线性;C 多 = 有机图标 → 渐变色常见)
- ❌ 禁止:**不要**用 d 数据**推断视觉语义**("这个 d 看起来像星 → 所以这是星") — 违反 STOP 红线 #1
- ❌ 禁止:把"d 看起来像 X"作为命名依据 — 命名必须靠渠道 1-5 文本信号

### 8 渠道优先级与置信度

| 渠道数命中 | 置信度 | 后续动作 |
|---|---|---|
| 渠道 1(`<title>`)+ 渠道 2(`data-name`)+ 渠道 3(注释) 三者都命中 | **high** | 直接命名+分类,跳过形状问 |
| 渠道 1 或 2 之一命中 | **medium** | 给 2-3 个候选 + 弹选项问"哪个更准" |
| 渠道 3-8 部分命中(只有注释/分组名/aria) | **medium** | 弹选项问"实际形状" |
| 8 个渠道都未命中 | **low** | 🔴 必须问设计师实际形状(违反则触发 §🛑 反例黑名单) |

> 💡 **优势**:多数 SVG 文件**至少 3 个渠道**会命中(Figma 导出的 SVG 通常有 title + data-* + 注释),置信度大概率是 medium 以上,设计师被问"实际形状"的频率大幅降低。

## 🔴 CHECKPOINT 触发"多轮动态问题"规则(runtime-neutral)

> **Runtime 中立**:本规则适用于任何支持 host agent 交互的运行时(Claude Code / Codex / OpenCode / Hermes / Gemini CLI 等)。实现细节以各 runtime 工具为准 —— Claude Code 用 `AskUserQuestion`,其他 runtime 用**等效的多选项交互工具**(`AskUserQuestion` / `request_user_input` / `prompt_user` 等),概念相同。

### 核心原则:**一次只问 1 个 question,根据上一轮回答动态构建下一轮**

- ❌ **禁止**一次问多个 question(如"形状?+颜色?+分类?"全堆一起)
- ✅ **必须**逐轮问,每轮根据上一轮答案**动态生成下一轮的 question 和 options**
- ✅ 收敛条件:拿到能确定命名 + 主分类 + 辅分类的最少信息即可停

### 触发场景(任一即触发多轮提问)

- `confidence=low` 且 `needs_visual_verification=true`
- badcase 命中(业务前缀 / 位置前缀 / 中文泛词 / 中文泛词冗长)
- 颜色冲突(多色渐变 / 单色 / 定色 难判)
- 分类歧义(命中多分类关键词,无法确定主分类)

### 动态构建流程(runtime-neutral)

```
第 1 轮:形状(必答)
  ↓ 拿到形状描述
第 2 轮(可选):形状细化 — 只在第 1 轮选了抽象描述(如"AI 风格")才追问
  ↓ 拿到细化信息
第 3 轮(可选):辅分类(颜色/样式) — 只在 SVG 含渐变/多色时才需要
  ↓ 拿到颜色决策
第 4 轮(可选):分类歧义消解 — 只在第 1 轮命中多分类关键词时追问
  ↓
输出最终: jc-icon-xxx · 主分类 · 辅分类
```

### 每轮 question 的通用结构

| 字段 | 含义 |
|---|---|
| `question` | 当轮的提问(根据上一轮答案动态生成) |
| `options` | 2-4 个互斥选项(根据上一轮答案的分支动态生成) |
| 推荐项 | 在 label 末尾加 "(推荐)" |
| 兜底项 | "其它" — 设计师自由输入 |

### Claude Code 实现示例(参考)

```js
// 第 1 轮:问形状(必答)
const shape = await AskUserQuestion({
  questions: [{
    question: "这个图标实际形状是什么?",
    header: "形状",
    options: [
      {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号"},
      {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
      {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"},
      {label: "其它形状", description: "告诉我具体形状"}
    ],
    multiSelect: false
  }]
})

// 第 2 轮:根据第 1 轮答案动态构建
// 选了"水晶+感叹号" → 追问水晶部分
// 选了"其它形状" → 追问自由描述
if (shape.includes("水晶") || shape.includes("其它")) {
  const detail = await AskUserQuestion({
    questions: [{
      question: shape.includes("其它")
        ? "请用一两个中文词描述形状"
        : "水晶部分具体长什么样?",
      header: "细化",
      options: shape.includes("其它")
        ? []  // 其它时系统自动给 Other
        : [
            {label: "六角水晶 (推荐)", description: "常规六边形"},
            {label: "钻石切面", description: "多面体"},
            {label: "水滴", description: "圆润轮廓"}
          ],
      multiSelect: false
    }]
  })
}

// 第 3 轮:只在需要时问辅分类(颜色/样式)
// 看到 SVG 含渐变 / 多色 / 模糊 才问
if (svgHasGradientOrMulticolor) {
  const color = await AskUserQuestion({
    questions: [{
      question: "这个图标的辅分类选哪个?",
      header: "辅分类",
      options: [
        {label: "渐变色 (推荐)", description: "保留现有渐变效果"},
        {label: "定色(多色)", description: "渐变替换为具体色值"},
        {label: "常规线性", description: "去掉渐变,改单色"}
      ],
      multiSelect: false
    }]
  })
}
```

设计师**不需要懂命令行**，跟 Claude 对话即可：
- 「帮我看下这个 SVG 该叫什么名字、放哪个分组」
- 「我想做一个 XX 图标，推荐个英文名」

## 设计师视角的常见场景

| 场景 | 你说的话 | Skill 会做的 |
|---|---|---|
| Figma 导出 SVG 想上传 | "帮我 check 一下 `icons/my-icon.svg`" | 读 SVG（连里面的中文名/注释一起读），推荐名字 + 主辅分类 |
| 只想取个英文名 | "推荐个名字，**双星图标**" | 给 1-2 个候选英文名，按团队规范 |
| SVG 里有中文名 | Figma 导出时勾选了"包含组件名" | 自动识别 SVG 里的中文名作为输入 |
| 不确定该放哪个分类 | "这个应该归到界面组件还是硬件？" | 看 SVG 关键词 + 中文名给出**主分类 + 辅分类**推荐 + 理由 |
| 文件名不规范（如 `agent点击-2026.svg`） | 跟平常一样让 Claude check | Skill 自动清洗文件名（去年份/版本/业务前缀），如果清洗后还判断不了形状，会**明确告诉你置信度低**，不会硬猜 |

> 🔴 **CHECKPOINT — 设计师交互必答三件套**：设计师跟 Skill 对话时，host agent 必须输出三件套：(1) 候选名字(2) 分组(3) 置信度。**只给名字不给置信度 = 没完成**。如果置信度为 low，必须停下来问设计师。

## 🛑 反例黑名单（host agent 不要做）

> 区分于 §修复模式速查（出错后怎么修），本节是**事前禁止** —— host agent 在推荐前先扫一遍本节，命中即停手。

### 范围外的能力

- ❌ 跟已有图标查重（上传时 IconPark 站内有查重工具）
- ❌ Figma 插件 / 飞书通知 / 自动同步
- ❌ **看图识形状** — Skill 只做文本分析。如果给了 `agent点击-2026.svg` 这种"看不出形状"的文件名，Skill 会说"我判断不了"，由 Claude 跟你确认实际形状后给出名字

### 🛑 STOP 红线（绝对禁止）

- 1. 禁止基于 SVG 路径数据猜测图标视觉形状
- 2. 禁止忽略 `needs_visual_verification=true` 信号直接给最终名字
- 3. 禁止推荐 `jc-icon-untitled` 作为最终答案（仅作占位）
- 4. 禁止在分类决策树没命中时硬猜（必须用默认分类 + 标 medium 置信度）
- 5. **🆕 禁止 host agent 默认采用主推 / 弹完选项自顾自继续**（违反 §🌐 强制约束 #3，必须等用户显式回应）
- 6. **🆕 禁止"只在 Claude Code 适配弹选项"** —— 跑在 Codex / OpenCode / Hermes / Gemini CLI 时必须用对应 runtime 的工具（违反 §🌐 强制约束 #2 映射表）
- 7. **🆕 禁止 host agent 绕过 §🛑 Fallback 协议** —— 跑在降级 runtime 时必须按 4 阶段轮询 + 超时报错,**禁止**"3 轮没回应我自己猜"或"我先用主推继续"
- 8. **🆕 禁止"干巴巴弹选项"** —— 必须按 §📋 流程驱动弹选项节点表,**先输出预分析卡片 → 再弹选项 → 等回应**,**禁止**"读完 SVG 直接弹'实际形状是什么?'"这种无上下文的提问

## Skill 的能力边界（重要）

**Skill 不做视觉识别**。它是一个纯文本分析工具，只读 SVG 里的文字内容（路径数据、注释、metadata）和文件名。

| Skill 能做的 | Skill 不能做的 |
|---|---|
| 读 SVG 里的 `<title>`、`<desc>`、注释、`data-*` 属性 | 看 SVG 渲染出来长什么样 |
| 用文件名 + 中文映射表查 identifier 候选 | 判断图标的视觉语义 |
| 跑分类决策树 | 跟已发布图标查重 |
| 跑命名规范 + goodcase/badcase 风格匹配 | 上传到 IconPark |

**当 Skill 判断不了时，它会明确告诉你**，而不是乱猜。例如 `agent点击-2026.svg`：
- 文件名：清洗后剩 `agent点击`，但语义不明
- SVG 内：没 metadata
- Skill 会标 `置信度：低`，并提示「请描述这个图标实际长什么样」

> 🔴 **CHECKPOINT — 低置信度强制确认**：当 confidence=low 或 needs_visual_verification=true 时，host agent **必须**问设计师「这个图标实际长什么样」拿到形状描述后，才输出最终名字。**禁止**在没拿到形状描述时直接用 `jc-icon-untitled` 当最终答案（占位候选仅用于设计师暂时没空补充的场景）。

🔴 **CHECKPOINT — 业务前缀强制确认**：文件名带 `agent-` / `app-` / `h5-` / `web-` / `mini-` 等业务前缀时，Skill 会自动剥离前缀输出警告。host agent **必须**确认「这个图标实际形状是什么」再接受推荐名，不能仅凭「agent点击」直接采纳 `jc-icon-clicking`。

这时由 Claude 决定下一步怎么走（可能问你、可能查已有图、可能用其他工具）—— Skill 本身不绑定任何外部能力，**只输出信号**。

## 命名规范（设计师须知）

依据《IconPark 绘制规范 - 公开版》：

- **英文名格式**：`jc-icon-<kebab-case>`，比如 `jc-icon-info`、`jc-icon-check-circle-filled`
- **小写 + 横杠**：不能有大写、空格、特殊符号；复合词按以下规则缩写：`search` → `search`、`magnifier` → `magnifier`、`notification` → `notif`、`information` → `info`、`configuration` → `config`、`arrow-down` → `arrow-down`(不缩)
- **按形状命名，不要按场景**：图标叫什么，看它**长什么样**，不要看它**用在哪里**
  - ✅ `jc-icon-info`（一个信息符号）
  - ❌ `jc-icon-tips-popup`（tips 是使用场景，popup 是位置）
  - ✅ `jc-icon-user`（一个人形）
  - ❌ `jc-icon-user-avatar`（avatar 是头像场景，user 已涵盖）
- **同义多图标**：用后缀 `-one` / `-two` / `-three` 区分（`like` / `like-one` / `like-two`）
- **不要给颜色/大小各开一个图标**：颜色由代码层 `fill` 控制，大小由 `size` 控制
- **如果图标是青色光标**：叫 `jc-icon-cursor`，**不要叫** `jc-icon-agent-click` 或 `jc-icon-cursor-2026`
- **文件名要规范**（Skill 会自动清洗）：
  - ✅ `cursor.svg` / `双星.svg` / `cursor-filled.svg`
  - ❌ `agent点击-2026.svg`（业务前缀 + 年份后缀，Skill 会清洗但置信度会很低）
- **🔴 推荐命名必须给 2-3 个备选**（不是只给 1 个）：
  - ✅ 主推 `jc-icon-search` + 备选 `jc-icon-magnifier` / `jc-icon-zoom`
  - ❌ 只给 1 个候选 `jc-icon-search`（设计师无选择，违反 §🌐 强制约束 #2）

## goodcase / badcase 学习（host agent 必读）

Skill 维护两套真实案例目录，**host agent 推荐命名/分类前必须参考**：

### goodcase 案例（32 个，规范）

`assets/goodcase/` 目录命名格式 `中文名_英文名.svg`(kebab-case + 同义多图标用 `-one`/`-two` 区分)。完整清单见 `assets/goodcase/` 目录,host agent 推荐命名时**直接 ls 该目录**学习风格。

**主分类分布**(32 个 goodcase 反推):
- **界面组件** (12): 首页/设置/搜索/更多/刷新/保存/全部/标签/汉堡图标/加载4/预览-关闭/配置
- **编辑** (2): 删除/放大
- **表情** (2): 喜欢/不喜欢
- **交流沟通** (2): 分享/订阅
- **链接** (2): 书签/书签-one
- **多媒体音乐** (2): 照片/均衡器
- **用户人名** (2): 男性/女性
- **硬件** (4): 开关/相机/雷达/瞄准
- **天气** (1): 闪电
- **时间日期** (1): 沙漏满
- **办公文档** (1): 法案

> 💡 **规律**:中文名取"形状/功能"，英文名取"行业通用名"（kebab-case），同义多图标用 `-one`/`-two`/`-three`/`-four` 区分。

### badcase 案例（14 个，常见问题）

`assets/badcase/` 目录典型问题分四类：

| 类别 | 文件示例 | 修复动作 |
|---|---|---|
| **业务前缀** | `AI人物口播.svg` / `AI原料.svg` / `Agent 1.svg` / `Agent引用-2026.svg` / `Agent点击-2026.svg` / `Agent编辑-2026.svg` / `agent-product-2025.svg` | 剥离 `AI-` / `Agent ` / `agent-` / `app-` 前缀；序号 `.1` 删掉 |
| **位置前缀** | `二级页面收起-2026.svg` | 剥离 `二级页面-` / `首页-` / `弹窗-`（"在哪儿用"不是形状） |
| **年份/版本后缀** | `*-2026.svg` / `*-2025.svg` | 清洗阶段去掉 |
| **🔴 中文泛词** | `数据.svg` / `暂无内容.svg` / `暂无文件.svg` / `消息通知.svg` / `营销类筛选项tab氛围图标.svg` | **必须问设计师**"实际长什么样";泛词冗长(`营销类筛选项tab氛围图标`)→ 拆 `tab` + 问"氛围图标"具体形状 |

> 🛑 **STOP 红线 — badcase 命中即报错**:host agent 看到与 badcase 同模式的命名,**禁止**直接采纳,**必须**走"剥离业务前缀/剥年份/问形状"流程。

## 分类规则（设计师须知）：双层结构

> **重要**:IconPark 官方分类以**语义/主题**为基础（36 选 1），不是色彩/样式。色彩/样式作为辅分类（7 选 1，可空）。

### 主分类（语义/主题，36 选 1，**必选**）

基于 `assets/goodcase/` 反推的 11 个高频分类（覆盖 32 个 goodcase 中的 32 个，**host agent 必须按此优先级推荐**）：

**界面组件**(12) · **硬件**(4) · **编辑**(2) · **表情**(2) · **交流沟通**(2) · **链接**(2) · **多媒体音乐**(2) · **用户人名**(2) · **天气**(1) · **时间日期**(1) · **办公文档**(1) · **其它**(兜底)

完整 36 类清单见 IconPark 官方分类（安全 & 防护 / 办公文档 / 编辑 / 表情 / 测量 & 试验 / 抽象图形 / 电商财产 / 动物 / 多媒体音乐 / 服饰 / 符号标识 / 工业 / 化妆美彩 / 几何图形 / 建筑 / 箭头方向 / 交流沟通 / 交通旅游 / 界面组件 / 链接 / 美颜调整 / 母婴儿童 / 能源 & 生命 / 品牌 / 生活 / 时间日期 / 食品 / 手势动作 / 数据 / 数据图表 / 体育运动 / 天气 / 星座 / 医疗健康 / 硬件 / 用户人名 / 游戏 / 其它）。其余 25 类关键词决策树在 `data/category-decision.json` 的 `primary_rules` 中。

### 辅分类（色彩/样式，7 选 1，**可空**）

| 辅分类 | 何时用 | 典型特征 |
|---|---|---|
| **常规线性** | 默认。空心/描边图标 | 描边色 = `#333` 或 `#000000`，无 fill |
| **高频线性** | 用户每天都用的基础图标 | 同上，但使用频次高 |
| **填充色** | 用实心填充而不是线条 | 包含 `fill="#xxx"` 实色 或 `-filled` 后缀 |
| **渐变色** | 有彩色渐变 | 包含 `linearGradient` / `radialGradient` |
| **品牌填充色** | 品牌专用 | 关键词含 `brand`/`logo`/品牌 |
| **定色（多色）** | 设计上就是多色/彩色 | 多个 fill 颜色值 |
| **iconfont 迁移** | 从老 iconfont 库迁过来 | 旧项目中要保留的图标 |

### 双层分类的输出格式

```
主分类: 界面组件
辅分类: 常规线性
完整分组: 界面组件 · 常规线性
```

> 🔴 **CHECKPOINT — 分类必答双件套**:设计师问"该放哪个分类"时,host agent **必须**输出**主分类 + 辅分类**双件套,不能只给一个。命中 badcase 模式时,必须问设计师"实际形状"再定主分类。
>
> 🔴 **CHECKPOINT — 分类必须给 2-3 个备选**:主分类**主推 1 个 + 备选 2-3 个**(共 3-4 个候选),辅分类**主推 1 个 + 备选 2-3 个**。单分类候选直接判定为**违反 §🌐 强制约束 #2**。

Skill 内部有一份双层关键词决策树（`data/category-decision.json`），自动匹配。

## 中文 → 英文名映射

如果你告诉 Skill "我想做一个**双星**图标"，它会推荐 `jc-icon-star`。中文到英文的映射表覆盖了 100+ 常用词（新增 / 删除 / 搜索 / 星星 / 闪光 / 收藏 / 购物车 / 光标 / 鼠标 / 指针 / 奖杯 / 勋章 …）。

**没识别到的中文**会触发警告，并给出 `jc-icon-untitled` 占位候选 —— 这意味着你需要手动补一个英文名。

## 修复模式速查（host agent 必查）

> 与 §🛑 反例黑名单（事前禁止）配套 —— 本节是**事后修复**。先看反例黑名单避免误操作，再回查本节处理已发生的失败。

| 触发条件 | 一线修复 | 仍失败兜底 |
|---|---|---|
| `confidence=low` 且 `needs_visual_verification=true` | 🔴 **必须**问设计师「这个图标实际长什么样」 | 拿到描述后基于中文映射 + 命名规范出最终名；仍拿不到 → 标 `jc-icon-untitled` 临时占位 + 工单跟进 |
| 中文未在 mapping 表（如"双"） | 拆字识别（"双星"= 拆为 "双"+"星"，用 "星" 命中） | 双字都未识别 → `jc-icon-untitled` + 提示补充 mapping |
| 文件名带业务前缀（`agent-`/`app-`/`h5-`/`web-`/`mini-`/`AI-`/`Agent ` 含空格） | 🔴 剥离前缀 + 警告"必须确认形状" | 设计师确认后用剥离后词根命名；不确认 → 标 `jc-icon-clicking` 等原始名 + low 置信度 |
| 文件名带年份/版本后缀（`-2026`/`-v2`/`-final`） | 自动清洗（`agent点击-2026.svg` → `agent点击.svg`） | 清洗后仍不可识别 → low 置信度 + needs_visual_verification |
| 文件名是中文泛词（`数据.svg` / `暂无内容.svg` / `消息通知.svg`） | 🔴 **必须**问设计师「这图标实际长什么样」（数据是柱状图？饼图？表格？） | 拿到描述后基于中文映射 + 命名规范出最终名；仍拿不到 → 标 `jc-icon-untitled` + 工单跟进 |
| 文件名是中文泛词冗长（`营销类筛选项tab氛围图标.svg`） | 🔴 拆解：`tab` 是位置 → 删；`氛围图标` 是抽象描述 → 问形状 | 设计师给具体形状后才能继续；否则 → `jc-icon-untitled` |
| 位置前缀（`二级页面-` / `首页-` / `弹窗-`） | 剥离位置前缀（"在哪儿用"不是形状） | 设计师确认形状后基于剥离后词根命名 |
| 分类决策树无关键词命中 | 默认"常规线性" + medium 置信度 | 设计师说"应该是 X" → 按设计师判断 + 反馈加入 mapping |
| SVG 文件不存在 / 解析失败 | 报错"无法读取 SVG" | 设计师重传 |
| 命令行参数错误 | 输出 usage + exit 1 | 无 fallback，设计师查 `--help` |
| **🆕 弹完选项后用户沉默/不回应** | 🔴 **禁止**默认采用主推或自顾自继续 — 重新弹相同选项 + 显式提示"请选择一个" | 设计师点击/选择后 → 拿到回应 → 才进入下一步;持续沉默 → 提示"是否需要我推荐别的候选" |
| **🆕 host agent 想"我先按主推走,不同意再改"** | 🔴 **绝对禁止** — 这等于剥夺设计师决策权 | 严格按 §🌐 强制约束 #3 执行:弹完即停,等回应 |
| **🆕 runtime 无 request_user_input 工具**(Codex CLI default 等) | 🔴 **禁止**"跳过等待" / **禁止**"我推断用户沉默=同意" / **禁止**绕过 fallback | 按 §🛑 Fallback 协议:阶段 1 纯文字 + ⏸ 等待 → 阶段 2 重试 → 阶段 3 升级(给 0/free 选项) → 阶段 4 超时报错切换 runtime |
| **🆕 host agent 调错 runtime 工具**(Codex 调 AskUserQuestion) | 🔴 错位调用直接报错 — 必须按 §🌐 强制约束 #2 映射表选对应工具 | 启用 `experimental_request_user_input` 切换到正确 API |
| **🆕 干巴巴弹选项(无流程上下文)** | 🔴 读完 SVG 不输出预分析卡片就直接弹"实际形状是什么?"—— 设计师无上下文无法判断 — 必须按 §📋 流程驱动弹选项节点表 | 弹选项前**先输出预分析卡片**(节点 A),再弹 A → B → F → C → D → E → G 节点链,每节点独立等回应 |

## 工作原理（设计师可跳过）

设计师不需要关心这个：

```
SVG 文件 ──┐
           ├─→ 读 SVG 内容（含中文名/注释）+ 对照 goodcase 风格
中文名 ────┘        │
                    ├─→ 推荐英文名（中文映射 + 反例词典 + 命名规范 + goodcase/badcase 学习）
                    ├─→ 推荐主分类（36 官方语义分类决策树 + badcase 警示）
                    ├─→ 推荐辅分类（7 色彩/样式分类决策树，可空）
                    ├─→ 计算 confidence（high / medium / low）
                    └─→ 输出推荐结果（命名 + 主分类 + 辅分类）
                              ↓
                       终端卡片展示结果（主+辅双件套）+ 复制粘贴文本
                              ↓
                  low confidence？ → 输出 needs_visual_verification 信号 → host 决定怎么处理
```

### 命令行（开发者参考）

```bash
# 默认：彩色卡片
iconpark check icons/my-icon.svg

# 结构化输出（含 confidence + needs_visual_verification 信号）
iconpark check icons/my-icon.svg --json

# 只取英文名
iconpark recommend 双星
iconpark recommend 闪光 常规线性
```

### 退出码语义

| 退出码 | 含义 |
|---|---|
| `0` | 通过，无 error |
| `1` | 有 naming error（任何模式都生效） |
| `2` | 仅 `--json` 模式：confidence=low 且 needs_visual_verification=true |

无外部依赖；纯 Node ≥18；命令行工具在 `scripts/iconpark.js`。