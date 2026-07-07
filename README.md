# iconpark-skill

帮你给 IconPark 图标取名 + 选分组。

## 安装

让 agent 帮你跑这条:

```text
npm install -g @yuwuchen/iconpark-skill --registry https://bnpm.byted.org/
```

装完在终端试一下:

```bash
iconpark help
```

看到版本号就装好了。

## 怎么用

直接告诉 agent:

- "帮我 check 这个 SVG 的命名 `icons/search.svg`"
- "我想做个双星图标,推荐个名字"
- "这个归界面组件还是硬件?"
- "我装好了,iconpark help 显示什么?"

agent 会自动调用 skill。

要手动跑也支持:

```bash
iconpark check icons/search.svg
iconpark recommend 双星
```

## 碰到问题

| 现象 | 怎么办 |
|---|---|
| agent 不识别这个 skill | 关掉 agent 重开,让它重新扫一下 skills 目录 |
| `iconpark` 不是命令 | 重启 terminal,或者 `hash -r` |
| 想试装别的版本 | `npm install -g @yuwuchen/iconpark-skill@0.7.5` |

## 自己改 SKILL.md

```bash
git clone https://github.com/YuWuChen82/iconpark-skill ~/.claude/skills/iconpark
```

改 `SKILL.md`,restart agent 生效。

## 版本

当前 **0.7.5**。每次启动 CLI 会自动检查更新,提示你升级。
