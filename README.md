# @yuwuchen/iconpark-skill

> IconPark 图标命名 + 分组推荐 —— 设计师 / Agent 双用，Node ≥22，零第三方依赖。

| | |
|---|---|
| 依赖 | Node ≥ 22；零第三方 |
| 完整规范 | [`SKILL.md`](./SKILL.md)（host agent 入口）|
| bnpm 包 | [@yuwuchen/iconpark-skill](https://bnpm.byted.org/package/@yuwuchen/iconpark-skill) |
| GitHub | [YuWuChen82/iconpark-skill](https://github.com/YuWuChen82/iconpark-skill) |

---

## 🪄 三种安装方式（任选其一）

所有 Skills-compatible runtime（Claude Code / Codex CLI / Gemini CLI / OpenCode / Cursor / Hermes 等）扫的注册位都是：

```
~/.{claude,codex,gemini,opencode,...}/skills/<name>/SKILL.md
```

下面三种方式都能注册到该位置。

### 方式 A · bnpm 全局安装 + postinstall 自动注册（团队推荐）

```bash
npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
```

`postinstall` 钩子自动把全局包软链到本机所有 host runtime 的 skills 目录。
**适合整团队分发**：所有人都用同一条命令。

### 方式 B · agentbuddy 一键安装（字节官方）

```bash
npm_config_registry="https://bnpm.byted.org" \
  pnpx agentbuddy@latest skill collection add DMvQel3R
```

字节标准的 skill 安装器，走 [skills.bytedance.net](https://skills.bytedance.net) 中央仓库。
**适合要把 skill 上架字节官方仓库的情况** —— 需要先把自己 skill 注册到该仓库。

### 方式 C · git clone 直装（最快，零 npm）

```bash
git clone https://github.com/YuWuChen82/iconpark-skill.git ~/.claude/skills/iconpark
```

仓库根就是 `SKILL.md`，host agent 直接识别；不需要 npm 全局包、不需要 postinstall。
**适合本地开发 / 个人使用**：改了 SKILL.md 想立刻测试，改完 restart agent 即可。

### 三种方式对比

| 场景 | 用哪个 |
|---|---|
| 自己改 SKILL.md 测试 | **C** git clone |
| 团队分发 + bnpm 已发布 | **A** npm install -g |
| 发布到字节官方仓库 | **B** agentbuddy |
| 卸载 | `node "$(npm root -g)/@yuwuchen/iconpark-skill/scripts/register-skill.cjs" --unlink` |
| | 或 `rm -rf ~/.{claude,codex}/skills/iconpark` |

---

## 🛠 CLI 用法（无论用哪种方式都能跑）

```bash
iconpark check icons/foo.svg               # 彩色卡片
iconpark check icons/foo.svg --json        # JSON 含 confidence + needs_visual_verification
iconpark recommend 双星                     # 纯命名
iconpark recommend 闪光 常规线性             # 带辅分类
iconpark update                             # 升级
iconpark help
```

退出码：`0` 通过 · `1` 有命名问题 · `2` confidence=low（仅 `--json` 模式）

> 如果 `iconpark` 不是命令：`hash -r` 重置 shell alias 缓存。CLI 入口在 `/usr/local/bin/iconpark` 或 `~/.local/bin/iconpark`。

---

## 🔧 故障排查

| 现象 | 原因 | 修法 |
|---|---|---|
| `which iconpark` 找不到 | CLI 没装到 PATH | 跑 `npm install -g` 重新装，或 `hash -r` |
| agent 不会调用 skill | SKILL.md 没被识别为 skill | 检查 `ls ~/.{你的runtime}/skills/iconpark/SKILL.md` 是否存在 |
| bnpm 装完 CLI 没注册到 skills 目录 | postinstall 没跑（可能装了本地包而非全局包）| 手动跑 `node scripts/register-skill.cjs` |
| 装完新版本 host agent 还识别旧的 | host agent 缓存了原 skill 路径 | 重启 host agent |
| 路径用了绝对路径导致 symlink 失败 | 部分 runtime 不接受绝对路径 | 用相对路径或改 postinstall 脚本 |

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
  register-skill.cjs   postinstall 自动软链到 host runtime
assets/
  goodcase/       31 个规范命名样例
  badcase/        13 个问题样例
```

---

## 🚢 发布（维护者参考）

```bash
npm run release:patch    # changeset → bump → git push → bnpm publish
```
