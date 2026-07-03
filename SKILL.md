---
name: iconpark
version: 0.3.0
description: "Use when a designer is preparing an IconPark icon and needs help with naming or two-tier categorization. Given an SVG file or Chinese description, recommends a standard identifier name, a primary semantic category (one of 36 official IconPark categories), an optional color sub-category (one of 7). Learns from goodcase/badcase reference sets in `assets/goodcase/` and `assets/badcase/` directories. Triggers: 'check SVG', '推荐名字', '选分组', '该放哪个分类', '命名不规范', 'jc-icon-', 'IconPark 上传'."
---

# IconPark 图标设计师助手

## Step-by-Step 设计师交互流程

**host agent 必须按此顺序执行**(每步都有显式输出):

1. **收输入** — 设计师给 SVG 路径 或 中文描述(可两者)
2. **读 SVG** — 解析 `<title>` / `<desc>` / 注释 / `data-*` 属性
3. **算置信度** — `high` / `medium` / `low`(基于 metadata 完整度)
4. **取名字** — 命中 `assets/goodcase/` 风格 → 输出 `jc-icon-<kebab-case>`;命中 `assets/badcase/` 模式 → 走"剥离业务前缀/剥年份/问形状"流程
5. **选主分类** — 从 36 官方语义分类(优先 11 高频 + goodcase 分布)推荐 1 个 + 备选
6. **选辅分类** — 从 7 色彩/样式分类(可空)推荐 1 个
7. **输出卡片** — 命名 + 主分类 + 辅分类 + 复制粘贴文本
8. **触发检查点** — `low` 置信度 / badcase 命中 / 业务前缀 → 🔴 必须用"多轮动态问题"问设计师(见下节)
9. **落库** — 设计师确认后输出最终 `jc-icon-xxx` 写入 IconPark 后台

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

> 💡 **优势**:
> - **认知负担低**:每轮只关注 1 个问题,2-3 秒决策
> - **上下文精准**:第 N 轮的 options 由第 N-1 轮答案动态生成,选项更相关
> - **收敛快**:拿到最少必要信息即停,不需要的轮次直接跳过
> - **可解析**:label 即主分类,description 锁定辅分类,无需追问"什么意思"

## 在设计师把图标上传到 IconPark **之前**，帮你做四件事：

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

## 不需要做的事

- ❌ 跟已有图标查重（上传时 IconPark 站内有查重工具）
- ❌ Figma 插件 / 飞书通知 / 自动同步
- ❌ **看图识形状** — Skill 只做文本分析。如果给了 `agent点击-2026.svg` 这种"看不出形状"的文件名，Skill 会说"我判断不了"，由 Claude 跟你确认实际形状后给出名字

> 🛑 **STOP 红线（绝对不要做）**：
> - 1. 禁止基于 SVG 路径数据猜测图标视觉形状
> - 2. 禁止忽略 `needs_visual_verification=true` 信号直接给最终名字
> - 3. 禁止推荐 `jc-icon-untitled` 作为最终答案（仅作占位）
> - 4. 禁止在分类决策树没命中时硬猜（必须用默认分类 + 标 medium 置信度）

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

Skill 内部有一份双层关键词决策树（`data/category-decision.json`），自动匹配。

## 中文 → 英文名映射

如果你告诉 Skill "我想做一个**双星**图标"，它会推荐 `jc-icon-star`。中文到英文的映射表覆盖了 100+ 常用词（新增 / 删除 / 搜索 / 星星 / 闪光 / 收藏 / 购物车 / 光标 / 鼠标 / 指针 / 奖杯 / 勋章 …）。

**没识别到的中文**会触发警告，并给出 `jc-icon-untitled` 占位候选 —— 这意味着你需要手动补一个英文名。

## 失败模式速查（host agent 必查）

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