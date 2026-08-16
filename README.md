# 已发送消息定位 (sent-msg-locator)

[English](README.en.md) · [中文](README.md)

![GitHub Release](https://img.shields.io/github/v/release/ShanHaiFish/sent-msg-locator)
![License](https://img.shields.io/github/license/ShanHaiFish/sent-msg-locator)
![GitHub Stars](https://img.shields.io/github/stars/ShanHaiFish/sent-msg-locator)

DSH 插件：**定位当前会话中每一轮对话**（一轮 = 用户发送 → 助手完整回复）。

在**对话区左缘**有一条常驻的浮动图标列：每一轮对话一个**气泡序号图标**，
点击图标平滑滚动定位到对应轮次的开头；当前浏览轮高亮联动，图标列自动跟随，
随对话实时更新。支持：

- **点击定位**：点击任意轮次的图标，聊天视口平滑滚动到该轮开头；
- **当前轮高亮**：随滚动自动指示「你正在看第几轮」，高亮图标始终可见；
- **实时更新**：新的一轮对话开始/完成后，图标列即时出现/更新对应图标；
- **悬停提示**：悬停图标显示「第 N 轮 · 时间（· 进行中 / 暂不可定位）」；
- **内部滚动**：轮次很多时图标列内部可滚动，自动跟随当前轮。

数据来自会话快照的官方 `chat.timeline`（`turnOrder` + `turns`，引擎级 Turn
边界），不依赖任何后端接口，不操作页面 DOM 全局。

> 纯 Client 插件：无 Host 能力（无 RPC / fs / 网络 / spawn），
> 滚动定位只使用元素级 API（`closest` / `getBoundingClientRect` / `scrollTo`）。

---

## 演示

![sent-msg-locator 演示动画](assets/demo.gif)

*点击图标平滑滚动定位到该轮用户输入文本,当前浏览轮高亮联动,随对话实时更新。*

---

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 左缘图标列 | 对话区左缘浮动窄列（约 28px），每轮一个气泡序号图标，常驻、无折叠开关 |
| 轮次单位 | 一轮 = 用户发送 → 助手完整回复完成（官方 Turn，含进行中状态） |
| 点击定位 | 平滑滚动到该轮开头；第一轮定位到会话开头 |
| 当前轮高亮 | 品牌色高亮当前浏览轮，随滚动自动切换；图标列自动滚动使高亮可见 |
| 进行中标记 | 未完成的轮次图标虚线 + 半透明，完成后恢复可点击 |
| 实时更新 | 随会话快照即时刷新；切换会话自动清空旧数据 |
| 主题适配 | 全部使用主题 CSS 变量（`--dsw-alias-*`），浅色/深色均保持对比 |

## 目录结构

| 路径 | 形态 | 说明 |
| --- | --- | --- |
| `package.json` + `cordis.patch.yml` + `lib/index.js` + `client/client.js` | **静态 bundle（推荐）** | `dsh plugin add` 安装后随 profile 层栈自动加载，跨 DSH 进程存续 |
| `manifest.json` + `client-source.js` | 动态插件回退形态 | 仅用于无 bundle 能力的 profile，需在每次重启后重新 `cordis_define` / `cordis_run` |
| `assets/demo.gif` | 演示动画 | README 介绍页的插件效果演示（约 11MB，压缩自 94MB 原始录屏） |

## 安装与使用

### 静态 bundle（推荐）

```sh
# 本地目录安装（路径不能含空格；也可先发布到 npm）。
# 本机已装：仓库先复制到 ~/.dsh/plugins-dev/sent-msg-locator（规避仓库路径含空格），
# 再从该路径安装到 web profile，已写入 profile 的 dsh.profile.bundles 层栈。
dsh plugin --profile web add file:C:/Users/whaow/.dsh/plugins-dev/sent-msg-locator

# 升级（重新复制 plugins-dev 副本后）
dsh plugin --profile web add file:C:/Users/whaow/.dsh/plugins-dev/sent-msg-locator
```

安装后**重启 DSH**（web profile 的 Loader 在启动时扫描 `dsh.client` 声明并挂载
bundle 层），打开任意会话，在对话区左缘即可看到图标列并使用；之后每次重启
DSH 都自动加载，无需重新注册。

### 动态插件（回退形态）

DSH 重启后，仓库里的源码文件只是存档，必须重新注册进当前进程：

1. 读取本目录 `client-source.js` 的完整内容；
2. 调用 `cordis_define`：
   - `plugin`: `{ "kind": "new", "idPrefix": "smsg" }`
   - `name`: `已发送消息定位`
   - `purpose`: `manifest.json` 中的 `purpose` 字段
   - `code.host`: `null`（纯 Client 插件）
   - `code.client`: `client-source.js` 的完整内容（函数体）
3. 调用 `cordis_run` 激活返回的 `pluginId`/`packageId`（首次需要用户批准）。

一句话提示词：「按 `sent-msg-locator` 目录重建已发送消息定位插件」。

## 行为细节（实现说明）

- 数据来源：`useSession` 快照 → **官方 `chat.timeline`（`turnOrder` + `turns`）为主、
  `chat.nodes` 聊天节点快照兜底**合并推导轮次（会话历史分页 `loadOlder` 时
  timeline 可能只含已加载窗口的轮次，节点快照含全部渲染节点，两者合并保证
  轮次不缺失）。每项提取 `turn`（轮次序号）/ `start.time` / `end.time` /
  `status`（`open` / `closed` / `unknown`）。
- 数据桥：`conversation.input.dock` 内隐藏桥（渲染 0 尺寸元素）捕获
  `useSession` 与 `sessionId`，同时**实测对话区左缘坐标**（元素级
  `getBoundingClientRect`）作为图标列 fixed 定位基准；侧边栏可折叠/拖拽
  改变宽度，桥内用 **timer 轮询（300ms）**持续校准，图标列始终贴在
  侧边栏右缘（对话区左缘）右侧；切换会话时清空旧数据。
  桥还会遍历 `chat.order`，为每个 turn 记录**第一条 `kind === 'user'`
  节点的 key**（用于精确跳转定位）。
- 轮尾锚点：`conversation.chat.assistant-actions` 槽（additive 列表槽）在每个
  已完成助手消息处渲染 0 尺寸锚点元素，通过 `messageId` 反查快照节点
  `data.turn` 得到轮次；首个锚点建立滚动容器（`closest('[data-conversation-scroll]')`）
  的 `scroll` 监听，用于当前轮检测。
- 点击定位：**精确滚动到该轮第一条用户输入的文本消息**——按快照节点 key
  匹配内置聊天视图的锚点行（`data-chat-anchor-key`，元素级 `querySelectorAll`），
  计算该行位置后平滑滚动；找不到时兜底到轮尾锚点位置。
  全程使用元素级 API（`getBoundingClientRect` / `scrollTo`），不触碰
  `document` / `window` 全局。
- 当前轮检测：滚动容器上监听 `scroll`，取**视口顶部之下第一个锚点**所属轮
  （锚点按轮次从上到下排列）；图标列内部用 `scrollIntoView({ block: 'nearest' })`
  自动跟随高亮。
- 全部走增量插槽（`conversation.input.dock` /
  `conversation.chat.assistant-actions` / `shell.overlay`），不替换任何内置 UI。

## 开发约定

见 `AGENTS.md`（给 AI 代理与本仓库协作者的运行手册）。

## 版本历史

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v2.2.0 | 2026-xx-xx | 安装形态切换：由动态插件正式切换为静态 bundle，已安装到 web profile（`~/.dsh/profiles/web`，经 `~/.dsh/plugins-dev/sent-msg-locator` 副本 `file:` 安装，加入 `dsh.profile.bundles` 层栈），随 profile 自动加载、跨 DSH 进程存续；动态形态（`manifest.json` + `client-source.js`）保留为回退；功能与 v2.1.12 完全一致，安全审查 ALLOW（0/300） |
| v2.1.12 | 2026-xx-xx | 新增：压缩点视觉分隔标记——DSH 自动压缩对话（compaction，阈值默认上下文 80%）后旧轮次自动从图标列消失，图标列顶部显示压缩小图标 + 虚线分隔（检测 `chat.nodes` 中 `kind === 'compaction'` 检查点节点），悬停提示「已压缩 N 条历史记录 · 约 M tokens」 |
| v2.1.11 | 2026-xx-xx | 优化：图标气泡尺寸缩小至原 80%（22→17.6px、字号 10.5→8.4px、圆角等比、顶部小图标 11→8.8px）；当前轮图标数字颜色改为按品牌色亮度自动取黑/白文字（`contrast-color()`，不支持时退回 `#fff`），修复浅色品牌主题下白色数字看不清的问题 |
| v2.1.10 | 2026-xx-xx | 调整：图标列与对话区左缘（侧边栏右缘）的间距由 5px 收窄为 2px |
| v2.1.9 | 2026-xx-xx | 调整：图标列与对话区左缘（侧边栏右缘）的间距由 7px 收窄为 5px |
| v2.1.8 | 2026-xx-xx | 调整：图标列与对话区左缘（侧边栏右缘）的间距由 14px 收窄为 7px |
| v2.1.7 | 2026-xx-xx | 优化：图标列竖条本体全透明（移除背景/边框/阴影/圆角），只保留气泡图标视觉；调整窗口宽度使图标列与对话文字重叠时，文字不再被竖条遮挡 |
| v2.1.6 | 2026-xx-xx | 修复：图标列左缘坐标基准改为聊天滚动容器 `[data-conversation-scroll]`——空白会话 hero 阶段（点击工作区开始新会话、发送第一条消息前后）composer 输入区居中受限宽度（约 812px），原以 dock 行左缘测量会让图标列远离侧边栏并悬浮遮挡输入框；滚动容器横跨整个会话列，左缘在 hero/active/settling 各阶段恒等于对话区左缘 |
| v2.1.5 | 2026-xx-xx | 修复：图标列恢复可见滚动条并加宽（28→40px），轮次多时可直观滚动浏览全部轮次 |
| v2.1.4 | 2026-xx-xx | 修复：轮次显示不全（官方 timeline 在分页时可能缺失较早轮次），改为 timeline 与聊天节点快照合并推导，保证全部轮次图标正常显示 |
| v2.1.3 | 2026-xx-xx | 修复：图标列与侧边栏右缘留出间距（left +14），避免贴边 |
| v2.1.2 | 2026-xx-xx | 修复：图标列垂直起点下移，避免遮挡会话标题栏「对话」视图标签 |
| v2.1.1 | 2026-xx-xx | 修复：图标列位置调整到侧边栏右缘（对话区左缘）右侧；timer 轮询校准坐标，侧边栏折叠/拖拽时自动跟随 |
| v2.1.0 | 2026-xx-xx | 优化：点击图标精确滚动定位到该轮第一条用户输入的文本消息（按快照节点 key 匹配内置聊天视图锚点行）；当前轮检测改为「视口顶部之下第一个锚点」，高亮更准确 |
| v2.0.0 | 2026-xx-xx | 重构为「对话区左缘图标列」：每轮一个气泡序号图标，点击平滑滚动定位到该轮开头，当前轮高亮联动并自动跟随；移除标题栏入口、右侧面板、搜索、展开全文、回填输入框；一轮 = 官方 Turn（用户发送 → 助手完整回复）；数据改走 `chat.timeline`；纯 Client，安全审查 ALLOW（0/300） |
| v1.0.0 | 2026-xx-xx | 首发：标题栏「消息定位」入口 + 右侧浮动面板，支持搜索、展开全文、回填输入框；纯 Client 实现，安全审查 ALLOW（0/300） |

## 安全说明

- 无 `spawn` / 网络请求 / 文件读写；不操作 `document` / `window` 全局，
  滚动定位仅用元素级 API；客户端仅使用 `ctx / React / styles / console`
  内置能力。
- 声明能力：无（纯 UI）。静态审查判定 **ALLOW（0/300）**。
