---
name: iconpark
version: 0.7.2
description: "Use when a designer is preparing an IconPark icon and needs help with naming or two-tier categorization. Given an SVG file or Chinese description, recommends a standard identifier name, a primary semantic category (one of 36 official IconPark categories), an optional color sub-category (one of 7). Learns from goodcase/badcase reference sets in `assets/goodcase/` and `assets/badcase/` directories. Runtime-neutral: works in Claude Code (AskUserQuestion), Codex CLI (request_user_input), OpenCode (TUI question), Hermes (prompt_user), Gemini CLI (request_user_input). **三级智能识别：文本 → 几何启发式 → 视觉 → 兜底询问，避免低置信度直接弹问让设计师觉得 AI 笨。** Triggers: 'check SVG', '推荐名字', '选分组', '该放哪个分类', '命名不规范', 'jc-icon-', 'IconPark 上传', 'AI 笨'."
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

   【节点F 低置信度·三级强制兜底】confidence=low 且 needs_visual_verification=true？
     是 → **必须按 Tier 顺序执行，禁止跳过到下一层**（详见 §五「三级智能识别」）：
       F1 启发式（必跑，零依赖）：host agent 读 SVG path d 几何模式（圆/方/星/线条），命中就给 medium 候选名 + 卡片标 medium + 进节点 G 弹"启发式识别是 [形状]，对吗？"
       F2 视觉（能力可用就跑）：host agent 渲染 SVG → 调用 vision/image 工具（Claude Code Read、Cline 截图、`mcp__*__understand_image` 等）→ 拿到形状描述后进节点 G
       F3 询问（F1+F2 都失败/无 vision 工具才用）：弹"实际是什么形状？" → 等回应，拿到描述前不得出最终名字
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
- **样式定型用后缀标注**：当 SVG 内嵌样式信息使样式成为图标本身的一部分时，名字加后缀标注（**仅样式"焊死"在图标里才加；颜色首选仍是代码 `fill`**）：
  - SVG 含 `<linearGradient>` / `<radialGradient>` → 名加 `-gradient`（例：`jc-icon-pointer-gradient`）
  - SVG 含 ≥2 个不同 `fill` 色值 → 名加 `-multicolor`（例：`jc-icon-pointer-multicolor`）
  - 含 `brand` / `logo` 关键词 → 名加 `-brand`
- **不为单纯样式切换开新图标**：颜色首选由代码 `fill` 控制，大小由 `size` 控制；若 SVG 已含样式后缀（`-gradient` / `-multicolor`），不要再造一个同名无后缀的图标——除非业务侧明确需要。
- **常见复合词缩写**：`notification`→`notif`、`information`→`info`、`configuration`→`config`；`arrow-down` 等不缩。
- **推荐命名必须给 2-3 个备选**（主推 1 个 + 备选 2 个），具体三栏表与三硬约束统一见 **§十**。

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
| 🔴 样式遗漏 | SVG 含 `linearGradient` 但名无 `-gradient` 后缀；或 SVG 含 ≥2 `fill` 色值但名无 `-multicolor` | 加 `-gradient` / `-multicolor` / `-brand` 后缀（见 §三），辅分类置"渐变色"或"定色(多色)" |
| 🔴 偷懒跳问 | 文本信号为 0 时直接弹"实际是什么形状"，跳过了 Tier 2 几何启发和 Tier 3 视觉 | **必跑 Tier 2 几何识别**（纯 path-d 推断，零依赖）；host agent 有 vision 时**必跑 Tier 3**；前三道全失败才允许 Tier 4 询问（详见 §五）|

🛑 命中 badcase 同模式的命名，**禁止**直接采纳，必须走"剥离前缀/剥年份/问形状"流程（对应§二节点B）。

---

## 五、Skill 的能力边界（三级智能识别）

**别让设计师觉得 AI 笨** —— 文本分析是第一关，但**视觉/几何能力范围内必须先用**，把"问设计师"留到最后一道。

| Tier | 做什么 | 用什么 | 用谁 |
|---|---|---|---|
| **1 文本** | 读 `<title>`/`<desc>`/注释/`data-*`/aria/`inkscape:label`/`<g id>`/`<symbol id>`/path 复杂度 | 文本信号 | host agent 必跑 |
| **2 启发式** | 读 path d 几何模式 → 估形（圆环/圆角矩形/星形/箭头/复合）| 纯几何推断，**零外部依赖** | host agent 文本全空时**必跑** |
| **3 视觉** | 渲染 SVG → host agent 用 vision/image 工具看图 | `Read`（Claude Code 支持图）、`mcp__*__understand_image`、`ask_followup_question` 截图等 | host agent 有 vision 工具就跑；无则跳过 |
| **4 询问** | 弹"实际是什么形状" | `AskUserQuestion` / 降级路径 B | **兜底**：Tier 1/2/3 全部失败才用 |

### Tier 2 启发式速查（path d 几何模式 → 推荐候选）

| 几何特征 | 大概率形状 | 候选名举例 |
|---|---|---|
| `M` 起点 + N 个对称 `a`(arc) 命令 + `Z` 闭合 | 圆环 / 圆形主体 | `jc-icon-ring` / `jc-icon-circle` |
| `M` + `r` rect + 一组倒角 | 圆角矩形 | `jc-icon-rectangle` / `jc-icon-card` |
| `M`(顶点) + 5+ 个 `l`(line) + `Z` | 多角星 / 雪花 | `jc-icon-star` / `jc-icon-pentagram` |
| 嵌套 path（一外大形 + 一内小形） | 表盘 / 摄像头 / 徽章 / 表 | `jc-icon-watch` / `jc-icon-camera` / `jc-icon-badge` |
| 单 path + 长 line series + 箭头头 | 箭头 / 折线 | `jc-icon-arrow-xxx` / `jc-icon-trend` |
| path d 长度 ≥ N + 多 `c`(cubic) | 有机曲线 / 装饰图形 | `jc-icon-wave` / `jc-icon-curve` |
| `fill` 唯一色 + 简单图形 | 单色线性图标 | 默认走"常规线性"辅分类，不加后缀 |
| `linearGradient`/`radialGradient` 出现 | 渐变已内嵌 | 名加 `-gradient`，辅分类"渐变色"（见 §三）|

⚠️ **Tier 2 是几何启发，不是像素识别**；命中置信度 **≤ medium**，必须进节点 G 弹"启发式识别是 [形状]，对吗？"让设计师确认，**不可直接跳到落库**。

⚠️ **Tier 2+Tier 3 都不到位时**才允许跳到 Tier 4 询问；跳过 Tier 2/Tier 3 直接问 = §四「偷懒跳问」badcase。

### 🛑 绝对禁止

1. **跳过 Tier 2 启发式 / Tier 3 视觉 直接问设计师** —— 这是让设计师觉得 AI 笨的根因。文本信号为 0 时**必须**先跑 Tier 2 几何识别；host agent 有 vision 工具时**必须**先跑 Tier 3 看图；前三道全失败才允许 Tier 4 询问。
2. 忽略 `needs_visual_verification=true` 信号直接给最终名字
3. 推荐 `jc-icon-untitled` 作为最终答案（仅作占位，不得当结果落库）
4. 分类决策树没命中时硬猜（必须用默认分类+标 medium 置信度）
5. **Tier 2 几何启发当 Tier 3 视觉用** —— 启发式置信度永远 ≤ medium；需要"颜色判定 / 形状细节 / 复合图标内部结构"等 Tier 3 层级判断时，必须经视觉工具，不准硬猜
6. **Tier 4 弹问后默认采用推荐项** —— 即便设计师沉默/未回应，也必须重弹选项，不可走 Tier 1 的"沉默=同意"路径（详见 §一原则 3）

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
| 渐变色 | 有彩色渐变（且推荐名加 `-gradient` 后缀，见 §三） | 含 `linearGradient`/`radialGradient` |
| 品牌填充色 | 品牌专用 | 关键词含 `brand`/`logo` |
| 定色(多色) | 设计上就是多色 | 多个 fill 色值 |
| iconfont 迁移 | 从老库迁过来 | 旧项目保留图标 |

输出格式：`主分类: 界面组件 / 辅分类: 常规线性 / 完整分组: 界面组件 · 常规线性`

🔴 主分类和辅分类**都必须给 2-3 个候选**（主推 1 + 备选 2），单候选视为违反 §一原则 2 与 **§十** 强约定；分类问设计师时必须**主+辅双件套**一起给，不能只给一个；具体三栏表格式见 §十。

---

## 七、中文 → 英文名映射

内置 100+ 常用词映射（新增/删除/搜索/星星/闪光/收藏/购物车/光标/鼠标/指针/奖杯/勋章…）。例："双星图标" → 推荐 `jc-icon-star`。**未识别到的中文**触发警告 + 给出 `jc-icon-untitled` 占位候选，提示需手动补英文名。未命中的双字词可拆字识别（"双星"拆"双"+"星"，用"星"命中）。

---

## 八、修复模式速查（触发条件 → 处理方式）

| 触发条件 | 处理方式 |
|---|---|
| `confidence=low` 且 `needs_visual_verification=true` | 🔴 **三级强制兜底（禁止跳层）**：F1 跑 Tier 2 几何启发式（path-d 模式）→ F2 跑 Tier 3 视觉（vision 工具看图）→ F3 才允许问设计师（详见 §五）。仍拿不到 → `jc-icon-untitled` 占位+工单跟进 |
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

## 十、多个命名/分组备选项输出约定（强约定）

🔴 **本节是 §三 命名 和 §六 分类 的统一执行入口**——两者凡提到 "2-3 个备选项" 处，统一按本章三栏式呈现，**禁止散落表述**导致格式漂移。

### 10.1 三栏表强制格式

任何命名（节点 C）/ 主分类（节点 D）/ 辅分类（节点 E）的最终卡片必须以三栏表呈现：

```
## 命名候选（示例：纯形状）
| 选项 | 标识符 / 分类 | 适用场景 |
|---|---|---|
| (推荐) | jc-icon-star | 单星主流用法 |
| 备选 1 | jc-icon-star-one | 双星 / 闪耀动效（与推荐互斥而非重复） |
| 备选 2 | jc-icon-sparkle | 强光芒、电商促销氛围 |

## 命名候选（示例：SVG 内嵌样式→§三 后缀规则生效）
| 选项 | 标识符 / 分类 | 适用场景 |
|---|---|---|
| (推荐) | jc-icon-pointer-gradient | 主 SVG 内嵌 `linearGradient` → 自动加 -gradient 后缀 |
| 备选 1 | jc-icon-pointer | 业务侧要单色版本时单独建图标 |
| 备选 2 | jc-icon-pointer-multicolor | SVG 含 ≥2 不同 `fill` 色值场景 |
```

| 列 | 内容要求 |
|---|---|
| 选项 | 必填 `(推荐)` / `备选 1` / `备选 2`，缺一即视为凑数 |
| 标识符 / 分类 | 必填 `jc-icon-xxx` 或分类中文名，禁止用 `jc-icon-untitled` 凑第二第三 |
| 适用场景 | 必填 1 行短描述，禁止空 |

### 10.2 三硬约束（每候选必同时满足，违反即视为违反 §一原则 2）

1. **≥2 个候选**（1 推荐 + ≥1 备选），单候选禁止。
2. **每个候选必配 1 行适用场景**，空场景 = 凑数备选，禁止。
3. **每个候选必独立可落地**，占位符 `jc-icon-untitled` 仅在 §八 "needs_visual_verification" 触发时**单用**，不得当备选项填进三栏表。

### 10.3 互斥性规则（避免凑数）

备选项之间必须**互斥而非同义**，让设计师能根据场景切换：

- ✅ `jc-icon-star`(单星) / `jc-icon-star-one`(双星) / `jc-icon-sparkle`(光芒)
- ❌ `jc-icon-star` / `jc-icon-star-filled` / `jc-icon-star-outline`(三个同义,违反互斥)

### 10.4 设计师追加备选时的应答规则

设计师说「再多给几个名字/分组」时，**必须**从三栏表扩到 4-5 个候选（仍是表格，每行带适用场景），**禁止**改成纯文字列表或开放问句「你想要哪个」。

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

## 团队安装 / 自更新协议

### 团队安装

```text
npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
iconpark help
```

Agent 安装检测到 `iconpark update` 提示时，用 `Bash` 执行 `npm update -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/`。

### 自更新（CLI）

**触发条件**：每次 CLI 启动时后台检查 bnpm 远端版本，有新版本时向 **stderr** 输出形如下方的黄色提示行：

```
⚠ iconpark: 本地 vX，远端 vY。运行 iconpark update 升级，或设 ICONPARK_NO_UPDATE_NOTIFY=1 关闭提醒。
```

**host agent 必须**：

1. 用 `AskUserQuestion`（或当前 runtime 的等价多选工具）询问用户：

   | 选项 | label | description |
   |---|---|---|
   | A | `立即更新 (推荐)` | 备份当前版本后 `npm update -g @yuwuchen/iconpark-skill`，失败自动回滚 |
   | B | `稍后提醒` | 静默继续本次流程，5 小时后再提醒 |
   | C | `本次跳过` | 静默继续本次，下次启动再问 |
   | D | `关闭提醒` | 永久关闭（`export ICONPARK_NO_UPDATE_NOTIFY=1`） |

2. 用户选 **A 立即更新** → `Bash("iconpark update")` → stdout 转告用户（含新版本号 + 备份路径）
3. 用户选 **B / C / D** → 静默继续，不复述提示

**禁止**：
- 看到 stderr 提示不弹选项
- 不询问直接 `npm update -g`
- 用 `git pull` 绕过（已废弃，不再支持 GitHub git pull 模式）

**环境变量**：

| 变量 | 作用 |
|---|---|
| `ICONPARK_NO_UPDATE_NOTIFY=1` | 永久关闭检查 |
| `ICONPARK_REGISTRY=<url>` | 覆盖 bnpm registry（内网/测试用）|
| `ICONPARK_PACKAGE_NAME=<pkg>` | 覆盖包名（fork 测试用）|

**实现细节**：`scripts/lib/updater.js` — 24h TTL 缓存 `~/.cache/iconpark/check.json`，fetch bnpm registry `dist-tags.latest`（3s），fallback 到 `npm view` CLI。`iconpark update` → 备份到 `~/.cache/iconpark/backups/<时间戳>_iconpark/` → `npm update -g @yuwuchen/iconpark-skill`。

**排查指南**：

1. `cat ~/.cache/iconpark/check.json` 看最近一次缓存的远端版本和时间
2. 手动测连通性：`npm view @yuwuchen/iconpark-skill version --registry https://bnpm.byted.org/`（应返回版本号）
3. 手动测更新：`npm update -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/`
4. 确认关闭：`echo $ICONPARK_NO_UPDATE_NOTIFY` 应为空