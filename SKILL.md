---
name: iconpark
version: 0.3.0
description: "Use when a designer is preparing an IconPark icon and needs help with naming, grouping, or pre-upload quality checks. Given an SVG file, recommends a standard identifier name and a category, and flags color/size/opacity issues that would make the icon fail at upload or be invisible in the product."
---

# IconPark 图标设计师助手

在设计师把图标上传到 IconPark **之前**，帮你做三件事：

1. **取名字** — 按团队规范给图标一个标准英文名（`jc-icon-xxx`）
2. **选分组** — 自动推荐放到哪个分类下（常规线性 / 渐变色 / 品牌色 …）
3. **找问题** — 揪出会导致上传失败或在产品里看不见的硬编码颜色、尺寸错误等

设计师**不需要懂命令行**，跟 Claude 对话即可：
- 「帮我看下这个 SVG 该叫什么名字、放哪个分组」
- 「我想做一个 XX 图标，推荐个英文名」

## 设计师视角的常见场景

| 场景 | 你说的话 | Skill 会做的 |
|---|---|---|
| Figma 导出 SVG 想上传 | "帮我 check 一下 `icons/my-icon.svg`" | 读 SVG（连里面的中文名/注释一起读），推荐名字 + 分组，列出需要修的问题 |
| 只想取个英文名 | "推荐个名字，**双星图标**" | 给 1-2 个候选英文名，按团队规范 |
| SVG 里有中文名 | Figma 导出时勾选了"包含组件名" | 自动识别 SVG 里的中文名作为输入 |
| 不确定该放哪个分组 | "这个应该算常规线性还是高频线性？" | 看 SVG 关键词 + 中文名给出推荐 + 理由 |
| 文件名不规范（如 `agent点击-2026.svg`） | 跟平常一样让 Claude check | Skill 自动清洗文件名（去年份/版本/业务前缀），如果清洗后还判断不了形状，会**明确告诉你置信度低**，不会硬猜 |

> 🔴 **CHECKPOINT — 设计师交互必答三件套**：设计师跟 Skill 对话时，host agent 必须输出三件套：(1) 候选名字(2) 分组(3) 置信度。**只给名字不给置信度 = 没完成**。如果置信度为 low，必须停下来问设计师。

## 不需要做的事

- ❌ 跟已有图标查重（上传时 IconPark 站内有查重工具）
- ❌ Figma 插件 / 飞书通知 / 自动同步
- ❌ **看图识形状** — Skill 只做文本分析。如果给了 `agent点击-2026.svg` 这种"看不出形状"的文件名，Skill 会说"我判断不了"，由 Claude 跟你确认实际形状后给出名字

> 🛑 **STOP 红线（绝对不要做）**：
> - 1. 禁止基于 SVG 路径数据猜测图标视觉形状
> - 2. 禁止忽略 `needs_visual_verification=true` 信号直接给最终名字
> - 3. 禁止推荐 `jc-icon-untitled` 作为最终答案（仅作占位）
> - 4. 禁止跳过 SVG 质量检查直接命名（即使 confidence=high 也要列出变体问题）
> - 5. 禁止在分类决策树没命中时硬猜（必须用默认分类 + 标 medium 置信度）

## Skill 的能力边界（重要）

**Skill 不做视觉识别**。它是一个纯文本分析工具，只读 SVG 里的文字内容（路径数据、注释、metadata）和文件名。

| Skill 能做的 | Skill 不能做的 |
|---|---|
| 读 SVG 里的 `<title>`、`<desc>`、注释、`data-*` 属性 | 看 SVG 渲染出来长什么样 |
| 用文件名 + 中文映射表查 identifier 候选 | 判断图标的视觉语义 |
| 跑分类决策树 | 跟已发布图标查重 |
| 跑变体检查（白色、viewBox、尺寸、透明度） | 上传到 IconPark |

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

## 分类规则（设计师须知）

| 分类 | 什么时候用 | 典型例子 |
|---|---|---|
| **常规线性** | 默认放这里。常规的描边线条图标 | 信息 / 警告 / 编辑 / 删除 / 箭头 / 闪光 / 光标 / 奖杯 |
| **高频线性** | 用户每天都要点的基础图标 | 首页 / 我的 / 设置 / 菜单 / 关闭 / 收藏 / 点赞 |
| **填充色** | 用实心填充而不是线条的图标 | `-filled` 后缀，或包含"填充" |
| **渐变色** | 有彩色渐变效果的图标 | `-gradient` 后缀，或包含"渐变" |
| **品牌填充色** | 仅用于品牌相关的图标 | brand / logo / 品牌 |
| **定色（多色）** | 设计上就是多色 / 彩色的图标 | 彩色徽章、品牌 logo 等 |
| **iconfont 迁移** | 从老 iconfont 库迁过来的旧图标 | 老项目中要保留的图标 |

Skill 内部有一份关键词决策树（`data/category-decision.json`），自动匹配。

## 中文 → 英文名映射

如果你告诉 Skill "我想做一个**双星**图标"，它会推荐 `jc-icon-star`。中文到英文的映射表覆盖了 100+ 常用词（新增 / 删除 / 搜索 / 星星 / 闪光 / 收藏 / 购物车 / 光标 / 鼠标 / 指针 / 奖杯 / 勋章 …）。

**没识别到的中文**会触发警告，并给出 `jc-icon-untitled` 占位候选 —— 这意味着你需要手动补一个英文名。

## 上传前必看：常见 SVG 问题

依据《IconPark 绘制规范 - 公开版》：

| 问题 | 严重度 | 原因 | 怎么修 |
|---|---|---|---|
| 用了**白色**作为图形色 | ⚠️ 必须修 | 白底网页端看不见 | 非彩色分类改成 `#000` / `#000000`；彩色分类改成具体彩色十六进制值 |
| **画板不是 48×48** | 🔴 必须修 | IconPark 标准是 `viewBox="0 0 48 48"` | 在 Figma 导出时把画板调到 48×48；内容偏左/偏上时用 `<g transform="translate(dx dy)">` 居中 |
| 写死了 `<svg width= height=>` | 🟡 可选改 | 上传后调不了大小 | 只保留 `viewBox`，删掉 `<svg>` 上的 width/height（filter 元素自身的 width/height 是 filter 区域参数，**不要删**） |
| `stroke-width` 不是 4 | 🟡 可选改 | 绘制规范默认 4px | 48x48 默认 `stroke-width="4"`；细线场景写 `2` 等需自行确认视觉一致 |
| 没设 `stroke-linecap` / `stroke-linejoin` | 🟡 可选改 | 绘制规范默认圆角端点 | 加 `stroke-linecap="round" stroke-linejoin="round"` |
| 用了 `opacity` 属性 | 🟡 可选改 | 上传后透明度改不了 | 用 `fill-opacity` / `stroke-opacity`，或代码层控制 |
| `fill="currentColor"` / 颜色名（black/white 等） | ⚠️ 工具不可识别 | IconPark 后台"勾选颜色"步骤扫描的是十六进制 | 改成 `fill="#xxx"` 形式（`#000000` / `#333` 等）；上传后在该步骤勾选让其变为 currentColor |

### 关键规则：IconPark 后台颜色勾选工具的识别逻辑

> 来源：IconPark 仓库 README 的颜色配置（outline 用 `fill="#000000"`、filled 用 `fill="#333"`、two-tone 用 `fill={['#333', '#2F88FF']}`、multi-color 用 `fill={['#333', '#2F88FF', '#FFF', '#43CCF8']}`），以及多次上传实测。

工具扫描的是 **`fill="#xxx"`** 和 **`stroke="#xxx"`** 形式的具体十六进制颜色值。**`currentColor`、颜色名（`black` / `white` 等）、`url(#xxx)` 渐变引用都不会被识别为"颜色"** —— 你会看到后台报"没有找到任何填充颜色 / 没有找到任何描边颜色"。

**正确做法**：
- 非彩色分类：默认用 `fill="#000000"` 或 `stroke="#000000"`，上传后在 IconPark 后台"勾选颜色"步骤勾选，让系统自动转成 currentColor 实现代码层可控
- 彩色分类（定色 / 渐变 / 填充色 / 品牌填充色）：保留具体色值（如 `fill="#2DFBF3"`），不需要勾选颜色

**配色原则**：除非是「定色 / 渐变色 / 填充色 / 品牌填充色」这四种多色分类，其他图标默认应是**黑色 `#000000`**（不要用 `currentColor` —— 工具不识别），由代码层通过 `fill` 属性上色。**白色在白色背景网页端是看不见的**，必须改。

## 失败模式速查（host agent 必查）

| 触发条件 | 一线修复 | 仍失败兜底 |
|---|---|---|
| `confidence=low` 且 `needs_visual_verification=true` | 🔴 **必须**问设计师「这个图标实际长什么样」 | 拿到描述后基于中文映射 + 命名规范出最终名；仍拿不到 → 标 `jc-icon-untitled` 临时占位 + 工单跟进 |
| 中文未在 mapping 表（如"双"） | 拆字识别（"双星"= 拆为 "双"+"星"，用 "星" 命中） | 双字都未识别 → `jc-icon-untitled` + 提示补充 mapping |
| 文件名带业务前缀（`agent-`/`app-`/`h5-`/`web-`/`mini-`） | 🔴 剥离前缀 + 警告"必须确认形状" | 设计师确认后用剥离后词根命名；不确认 → 标 `jc-icon-clicking` 等原始名 + low 置信度 |
| 文件名带年份/版本后缀（`-2026`/`-v2`/`-final`） | 自动清洗（`agent点击-2026.svg` → `agent点击.svg`） | 清洗后仍不可识别 → low 置信度 + needs_visual_verification |
| SVG 内 `fill="white"` / `fill="#FFF"` | 警告"非彩色分类必须改 #000000" | 设计师说"这是彩色分类" → 接受 + 归入"填充色/定色" |
| SVG `viewBox` 不是 `0 0 48 48` | 警告"画板尺寸不对" | 设计师坚持不上传 → 接受但保留警告 |
| SVG 用 `opacity` 属性 | 🟡 可选改用 `fill-opacity` / `stroke-opacity` | 设计师不改 → 接受（IconPark 会报但不阻断） |
| SVG 用 `currentColor` / 颜色名 | 警告"后台工具不识别" | 设计师说"用代码层控制" → 接受 + 标"上传后需手动勾选" |
| 分类决策树无关键词命中 | 默认"常规线性" + medium 置信度 | 设计师说"应该是 X" → 按设计师判断 + 反馈加入 mapping |
| SVG 文件不存在 / 解析失败 | 报错"无法读取 SVG" | 设计师重传；若持续失败 → 必须用 Figma 重新导出 48×48 |
| 命令行参数错误 | 输出 usage + exit 1 | 无 fallback，设计师查 `--help` |

## 工作原理（设计师可跳过）

设计师不需要关心这个：

```
SVG 文件 ──┐
           ├─→ 读 SVG 内容（含中文名/注释）
中文名 ────┘        │
                    ├─→ 推荐英文名（中文映射 + 反例词典 + 命名规范）
                    ├─→ 推荐分组（关键词决策树）
                    ├─→ 计算 confidence（high / medium / low）
                    └─→ 检查 SVG 质量问题（颜色/尺寸/透明度）
                              ↓
                       终端卡片展示结果 + 复制粘贴文本
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
| `1` | 有 naming/variant error（任何模式都生效） |
| `2` | 仅 `--json` 模式：confidence=low 且 needs_visual_verification=true |

无外部依赖；纯 Node ≥18；命令行工具在 `bin/iconpark`。