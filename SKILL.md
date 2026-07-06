---
name: iconpark
version: 0.5.0
description: "Use when a designer is preparing an IconPark icon and needs help with naming or two-tier categorization. Given an SVG file or Chinese description, recommends a standard identifier name, a primary semantic category (one of 36 official IconPark categories), an optional color sub-category (one of 7). Learns from goodcase/badcase reference sets in `assets/goodcase/` and `assets/badcase/` directories. Runtime-neutral: works in Claude Code (AskUserQuestion), Codex CLI (request_user_input), OpenCode (TUI question), Hermes (prompt_user), Gemini CLI (request_user_input). **v0.5+ 每次使用自动检查更新并提示用户。** Triggers: 'check SVG', '推荐名字', '选分组', '该放哪个分类', '命名不规范', 'jc-icon-', 'IconPark 上传'."
---

# IconPark 图标设计师助手

## 核心原则（最高优先级，贯穿全流程，下文所有章节都是这四条的落地）

1. **中文输出**：所有面向设计师的文案（问题/理由/卡片/错误信息）必须中文；仅 identifier 本身（`jc-icon-xxx`）和代码块保留英文。
2. **必须弹选项，禁止纯文字自问自答**：任何需要设计师决策的点，用当前 agent 的原生多选项工具弹出 **2-3 个互斥选项**（系统自动提供"其它"兜底自由输入），推荐项 label 末尾加"(推荐)"。禁止"你想要什么？"这类开放式提问，禁止代设计师直接做决定。
3. **弹完必须等，未回应 = 未完成**：弹选项只是第一步，拿到设计师**显式**回应才算完成。禁止"先按推荐执行，不同意再改"；沉默 ≠ 同意，沉默时重新弹相同选项，不得默认采用推荐项继续往下走。
4. **内部动作不输出**：runtime 检测 / 路径选择 / 置信度计算过程 / 步骤进度汇报，一律静默执行，只输出结果（预分析卡片 / 选项 / 最终卡片 / 错误信息）。设计师主动问"为什么"时给**结论**，不复述推理过程。

> 例：设计师问"为什么不直接用 jc-icon-star？" → 答"SVG 是双星重叠，不是单星，改成 jc-icon-sparkle 更准"（结论），不要说"我解析了 path d 命令后发现…"（过程）。

---

## 一、Agent 适配：怎么弹选项

### 路径 A：有原生多选项工具（优先，必须用）

| Agent | 工具 | 备注 |
|---|---|---|
| Claude Code | `AskUserQuestion` | 内置 |
| Codex CLI | `request_user_input` | 需 `~/.codex/config.toml` 开 `experimental_request_user_input=true`，否则降级走路径 B |
| Cline / Roo Code | `ask_followup_question` | 内置，VS Code 扩展 |
| GitHub Copilot | `ask_user` | 内置 |
| OpenCode | TUI `question` | 通过 `permissions.questions` 配置，YAML frontmatter 标 `tool: "question"` |
| Hermes | `prompt_user` | 内置 |
| Gemini CLI | `request_user_input` | 复用 Codex 兼容 schema |

调用示例（各 agent 字段命名风格不同，camelCase / snake_case 视其 API 而定，结构统一为 question + header/label + options[]）：

```js
// Claude Code
await AskUserQuestion({
  questions: [{
    question: "这个图标实际形状是什么？",
    header: "形状",
    options: [
      {label: "感叹号/警告三角 (推荐)", description: "单纯警告符号"},
      {label: "水晶+感叹号", description: "AI 风格的水晶出错图标"},
      {label: "机器人/人形", description: "类似表情的'困惑/失败'角色"}
    ],
    multiSelect: false
  }]
})
```

- host agent 启动时从 `process.env` / agent 元数据识别当前 agent，**只**调用对应工具；禁止调错（例如在 Cline 里写 `AskUserQuestion`）。
- 原生工具可用时禁止绕过走路径 B，即使"觉得路径 B 更简单"。

### 路径 B：无原生工具（降级）

上表中任何工具都不可用时，纯文字编号列表 + 强制等待协议：

```
请告诉我这个图标的实际形状(回数字即可)：
[1] 感叹号/警告三角 (推荐) — 单纯警告符号
[2] 水晶+感叹号 — AI 风格的水晶出错图标
[3] 机器人/人形 — 类似表情的"困惑/失败"角色
(系统自动提供"其它"自由输入)
```

4 阶段轮询：**第1轮**出题 → **第2轮**（未回应）原样重发 + 提示"上一轮我在等" → **第3轮**（仍未回应）升级出 `[0]`/`[free]` 显式退出项 → **第4轮**（仍未回应）报超时终止，提示切换 agent。任何阶段禁止"推断沉默 = 同意"。

---

## 二、完整工作流程

设计师给一个 SVG 路径 和/或 中文描述，host agent 按以下顺序执行。**每个弹选项节点都遵循"先输出卡片 → 再弹选项 → 等回应 → 才进下一节点"**，不省略卡片，不跳过等待：

```
1. 收输入
2. 读 SVG（8 信号渠道，见下表；不做像素形状识别）→ 算 confidence: high/medium/low

3. 【节点A 预分析·必弹】输出预分析卡片 → 弹"预分析对得上吗？" → 等回应
     完全对 → 跳到 5 │ 形状/分类预判有误 → 回 2 重新推断 │ 自由补充 → 重新走 2

4. 【节点B badcase】命中业务前缀/位置前缀/中文泛词等已知问题模式(见§四)？
     是 → 弹"剥离/拆解后实际是什么？" → 等回应 │ 否 → 跳过

   【节点F 低置信度】confidence=low 且 needs_visual_verification=true？
     是 → 🔴 必须弹"这个图标实际是什么形状？" → 等回应，拿到描述前不得出最终名字
     否 → 跳过

5. 【节点C 命名】中文映射命中 ≥2 候选，或需设计师定名字？
     弹 2-3 个 jc-icon-xxx 候选(含1个推荐) → 等回应

6. 【节点D 主分类】决策树命中 ≥2 分类，或需要确认？
     弹 2-3 个主分类候选(36选1，优先11高频类，见§六) → 等回应

7. 【节点E 辅分类】SVG 含渐变/多色需要判断？
     弹 2-3 个辅分类候选(7选1，可空) → 等回应

8. 【节点G 落库确认·必弹】输出最终卡片(identifier+主分类+辅分类+置信度+依据+复制粘贴文本)
     弹"确认落库？" → 等回应
     确认 → 完成 │ 改名/分类 → 回 5/6 │ 暂停 → 草稿保留，不落库
```

- 触发条件不互斥：一次流程可能连续命中 A→B→F→C→D→E→G 多个节点，**每个节点独立等一次回应**，禁止一次性堆多个问题。
- confidence=high 且无歧义时，可以从节点 A 直接跳到节点 G（跳过 B/F/C/D/E），但**已触发的节点不能跳过其"卡片→弹选项→等回应"三步**。

### 读 SVG 的 8 个信号渠道（不靠像素识别，只做文本/结构推断）

| # | 渠道 | 提取内容 | 权重 |
|---|---|---|---|
| 1 | `<title>` / `<desc>` | 中文名(最高优先级) / 形状描述 | 高 |
| 2 | `data-*` 属性 | `data-zh`/`data-en`/`data-icon-name`(直接采纳)/`data-category` | 高 |
| 3 | 全部注释 `<!-- -->` | Figma 组件名/图层名/分组，常含中文 | 中 |
| 4 | aria 属性 | `aria-label`，辅助 `<title>` 缺失场景 | 中 |
| 5 | 命名空间属性 | `inkscape:label` / `figma:node-id` | 中 |
| 6 | `<g id>` + transform | id 常含中文；rotate/scale 提示旋转对称结构(星/雪花) | 低 |
| 7 | defs/symbol/use | `<symbol id="icon-xxx">` = 已有 identifier | 中 |
| 8 | path `d` 命令关键字 | 仅作复杂度信号(A=弧线,L=多边形,C=有机形状)；**禁止**据此推断视觉语义 | 辅助 |

**置信度判定**：渠道1+2+3 都命中 → `high`(直接命名，跳过形状问)；渠道1或2命中其一 → `medium`(给候选+弹选问哪个更准)；只命中渠道3-8 → `medium`(弹选问实际形状)；8 个渠道全未命中 → `low`(🔴 必须问形状，不得硬猜)。

---

## 三、命名规范

依据《IconPark 绘制规范 - 公开版》：

- **格式**：`jc-icon-<kebab-case>`，如 `jc-icon-info`、`jc-icon-check-circle-filled`；小写+横杠，无大写/空格/特殊符号。
- **按形状命名，不按场景**：图标叫什么看它**长什么样**，不看它**用在哪里**。✅ `jc-icon-info` ❌ `jc-icon-tips-popup`；✅ `jc-icon-user` ❌ `jc-icon-user-avatar`。
- **同义多图标**：用后缀 `-one`/`-two`/`-three` 区分（`like`/`like-one`/`like-two`）。
- **不为颜色/大小开新图标**：颜色由 `fill` 控制，大小由 `size` 控制。
- **常见复合词缩写**：`notification`→`notif`、`information`→`info`、`configuration`→`config`；`arrow-down` 等不缩。
- **推荐命名必须给 2-3 个备选**（主推1个+备选2个，不能只给1个，见§一原则2）。

---

## 四、goodcase / badcase 学习（推荐前必查）

### goodcase（32 个规范案例）

`assets/goodcase/` 命名格式 `中文名_英文名.svg`，host agent 推荐命名时直接 `ls` 该目录学习风格。主分类分布（32 个反推）：**界面组件**(12)·**硬件**(4)·编辑(2)·表情(2)·交流沟通(2)·链接(2)·多媒体音乐(2)·用户人名(2)·天气(1)·时间日期(1)·办公文档(1)。

> 规律：中文名取"形状/功能"，英文名取"行业通用名"(kebab-case)，同义多图标用 `-one`/`-two` 区分。

### badcase（14 个问题案例，4 类典型问题）

| 类别 | 示例 | 修复动作 |
|---|---|---|
| 业务前缀 | `AI人物口播.svg`/`Agent点击-2026.svg`/`agent-product-2025.svg` | 剥离 `AI-`/`Agent `/`agent-`/`app-` 前缀，序号 `.1` 删掉 |
| 位置前缀 | `二级页面收起-2026.svg` | 剥离 `二级页面-`/`首页-`/`弹窗-`（"在哪儿用"不是形状） |
| 年份/版本后缀 | `*-2026.svg`/`*-v2.svg` | 清洗阶段直接去掉 |
| 🔴 中文泛词 | `数据.svg`/`暂无内容.svg`/`消息通知.svg`/`营销类筛选项tab氛围图标.svg` | **必须问设计师**"实际长什么样"；冗长泛词先拆位置词(`tab`)再问抽象部分 |

🛑 命中 badcase 同模式的命名，**禁止**直接采纳，必须走"剥离前缀/剥年份/问形状"流程（对应§二节点B）。

---

## 五、Skill 的能力边界

**Skill 不做视觉识别**，是纯文本分析工具，只读 SVG 里的文字内容和文件名。

| 能做 | 不能做 |
|---|---|
| 读 `<title>`/`<desc>`/注释/`data-*` | 看 SVG 渲染出来长什么样 |
| 用文件名+中文映射表查候选 | 判断图标的视觉语义 |
| 跑分类决策树 | 跟已发布图标查重(IconPark 站内有工具) |
| 跑命名规范+goodcase/badcase 风格匹配 | 上传到 IconPark、Figma插件、飞书通知等自动化 |

判断不了时明确告诉设计师，不乱猜。例：`agent点击-2026.svg` 清洗后剩"agent点击"但语义不明，SVG 内无 metadata → 标"置信度：低"，提示"请描述这个图标实际长什么样"（对应§二节点F）。

### 🛑 绝对禁止

1. 基于 SVG 路径数据猜测图标视觉形状
2. 忽略 `needs_visual_verification=true` 信号直接给最终名字
3. 推荐 `jc-icon-untitled` 作为最终答案（仅作占位，不得当结果落库）
4. 分类决策树没命中时硬猜（必须用默认分类+标 medium 置信度）

---

## 六、分类规则：双层结构

IconPark 官方分类以**语义/主题**为基础，不是色彩/样式；色彩/样式作为可选辅分类。

### 主分类（36 选 1，必选）

基于 goodcase 反推的 11 个高频分类（host agent 按此优先级推荐）：**界面组件**·硬件·编辑·表情·交流沟通·链接·多媒体音乐·用户人名·天气·时间日期·办公文档·**其它**(兜底)。完整 36 类清单及其余 25 类关键词决策树见 `data/category-decision.json` 的 `primary_rules`。

### 辅分类（7 选 1，可空）

| 辅分类 | 何时用 | 特征 |
|---|---|---|
| 常规线性 | 默认，空心/描边图标 | 描边 `#333`/`#000`，无 fill |
| 高频线性 | 用户每天用的基础图标 | 同上，使用频次高 |
| 填充色 | 实心填充 | `fill="#xxx"` 或 `-filled` 后缀 |
| 渐变色 | 有彩色渐变 | 含 `linearGradient`/`radialGradient` |
| 品牌填充色 | 品牌专用 | 关键词含 `brand`/`logo` |
| 定色(多色) | 设计上就是多色 | 多个 fill 色值 |
| iconfont 迁移 | 从老库迁过来 | 旧项目保留图标 |

输出格式：`主分类: 界面组件 / 辅分类: 常规线性 / 完整分组: 界面组件 · 常规线性`

🔴 主分类和辅分类**都必须给 2-3 个候选**（主推1+备选2），单候选视为违反§一原则2；分类问设计师时必须**主+辅双件套**一起给，不能只给一个。

---

## 七、中文 → 英文名映射

内置 100+ 常用词映射（新增/删除/搜索/星星/闪光/收藏/购物车/光标/鼠标/指针/奖杯/勋章…）。例："双星图标" → 推荐 `jc-icon-star`。**未识别到的中文**触发警告 + 给出 `jc-icon-untitled` 占位候选，提示需手动补英文名。未命中的双字词可拆字识别（"双星"拆"双"+"星"，用"星"命中）。

---

## 八、修复模式速查（触发条件 → 处理方式）

| 触发条件 | 处理方式 |
|---|---|
| `confidence=low` 且 `needs_visual_verification=true` | 🔴 问形状(节点F) → 拿到描述后出名字；仍拿不到 → `jc-icon-untitled` 占位+工单跟进 |
| 中文未在映射表 | 拆字识别；双字都未识别 → `jc-icon-untitled`+提示补充映射 |
| 业务前缀(`agent-`/`app-`/`AI-`等) | 🔴 剥离+确认形状(节点B)；不确认 → 标原始名+low 置信度 |
| 年份/版本后缀 | 自动清洗；清洗后仍不可识别 → low+`needs_visual_verification` |
| 中文泛词(`数据`/`暂无内容`) | 🔴 问形状(节点B) |
| 中文泛词冗长(`营销类筛选项tab氛围图标`) | 拆位置词(`tab`)后问抽象部分具体形状 |
| 位置前缀(`二级页面-`/`首页-`) | 剥离后确认形状 |
| 分类决策树无关键词命中 | 默认"常规线性"+medium 置信度，设计师纠正后反馈进映射表 |
| SVG 不存在/解析失败 | 报错"无法读取 SVG"，设计师重传 |
| 弹完选项用户沉默 | 重新弹相同选项+提示"请选择一个"，不默认采用推荐 |
| 降级 runtime 无原生工具 | 按§一路径B的4阶段轮询，不推断沉默=同意 |

---

## 九、设计师视角的常见场景

| 场景 | 你说的话 | Skill 会做的 |
|---|---|---|
| Figma 导出想上传 | "帮我 check 一下 `icons/my-icon.svg`" | 读 SVG(含中文名/注释)，推荐名字+主辅分类 |
| 只想取个英文名 | "推荐个名字，双星图标" | 给 2-3 个候选英文名 |
| 不确定分类 | "这个应该归界面组件还是硬件？" | 给主分类+辅分类推荐+理由 |
| 文件名不规范 | 让 Claude 正常 check | 自动清洗(去年份/前缀)，仍判断不了会明确说置信度低，不硬猜 |

🔴 **交互必答三件套**：任何一次推荐都必须输出 (1)候选名字 (2)分组 (3)置信度。置信度 low 时必须停下问设计师，不能只给名字了事。

---

## 命令行（开发者参考）

```bash
iconpark check icons/my-icon.svg              # 默认：彩色卡片
iconpark check icons/my-icon.svg --json       # 结构化输出(含 confidence + needs_visual_verification)
iconpark recommend 双星                        # 只取英文名
iconpark recommend 闪光 常规线性                # 带辅分类
```

| 退出码 | 含义 |
|---|---|
| `0` | 通过，无 error |
| `1` | 有 naming error(任何模式都生效) |
| `2` | 仅 `--json` 模式：confidence=low 且 needs_visual_verification=true |

无外部依赖；纯 Node ≥18；命令行工具在 `scripts/iconpark.js`。

---

## 六、自更新协议（最高优先级之一，v0.5+ 生效）

**触发条件**：CLI 在 **stderr** 输出形如下方的黄色提示行：

```
⚠ iconpark: 本地 v0.4.0，远端 v0.5.0。运行 iconpark update 升级，或设 ICONPARK_NO_UPDATE_NOTIFY=1 关闭提醒。
```

**你必须**：

1. 用 `AskUserQuestion`（或当前 runtime 的等价多选工具）询问用户，4 个选项：

   | 选项 | label | description |
   |---|---|---|
   | A | `立即更新 (推荐)` | 备份当前版本后升级，失败自动回滚 |
   | B | `稍后提醒` | 静默继续本次流程，5 小时后再提醒 |
   | C | `本次跳过` | 静默继续本次，下次启动再问 |
   | D | `关闭提醒` | 永久关闭，不再询问（可手动 `iconpark update`） |

2. 用户选 **A 立即更新** → 调 `Bash("iconpark update")` → 把 stdout 转告用户（含新版本号 + 备份路径）
3. 用户选 **B / C / D** → 静默继续本次流程，不复述提示

**禁止**：
- 看到 stderr 提示不告知用户（违反"弹选项必须问"的核心原则）
- 不询问直接执行 `iconpark update`（用户没同意）
- 用 `git pull` / 手动改文件绕过 skill 自带更新（破坏备份/回滚链）
- 把 stderr 提示当成 stdout 报错处理（这是信息，不是错误）

**环境变量**（团队自管理用）：

| 变量 | 作用 |
|---|---|
| `ICONPARK_NO_UPDATE_NOTIFY=1` | 永久关闭检查（写入 ~/.cache/iconpark/check.json 也会被尊重） |
| `ICONPARK_VERSION_URL=<url>` | 覆盖默认远端（团队内网 fork / 测试用） |

**实现细节**（如需了解）：`scripts/lib/updater.js` — fire-and-forget 后台检查，24h TTL 缓存（`~/.cache/iconpark/check.json`），3s 网络超时静默失败，update 子命令先备份到 `~/.cache/iconpark/backups/<时间戳>_iconpark/` 再 `git pull`。
