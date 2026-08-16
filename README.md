# 已发送消息定位 (sent-msg-locator)

DSH 插件：**定位当前会话中每次通过输入框发送的消息**。

在会话标题栏点击「消息定位」按钮，右侧滑出 360px 浮动面板，列出本会话全部已发送消息
（序号 `#N` / 发送时间 / 内容摘要，最新在前）。支持：

- **关键词搜索**：按消息内容或序号过滤，快速找到某次发送的内容；
- **展开全文**：点击条目展开完整文本（图片消息标注「含图片」）；
- **回填输入框**：点击「回填输入框」把该条消息的完整内容放回聊天输入框
  （追加到现有草稿、不覆盖），方便重新使用或改写后再次发送。

数据来自会话快照（`ConversationSnapshot.nodes` 中 `kind === 'user'` 的节点），
每次发送新消息面板即时更新，不依赖任何后端接口。

> 纯 Client 插件：无 Host 能力（无 RPC / fs / 网络 / spawn），不操作页面 DOM。

---

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 标题栏入口 | 会话标题栏「消息定位」按钮，带已发送条数角标，点击开关面板 |
| 消息列表 | 全部已发送消息：序号 `#N`（对话内第 N 条用户消息）、时间（当天 HH:mm，跨天带日期）、单行摘要 |
| 搜索过滤 | 按内容关键词或序号过滤；无匹配时显示空态提示 |
| 展开全文 | 点击条目展开/收起完整文本（保留换行），图片消息标注「含图片」 |
| 回填输入框 | 把消息内容追加到输入框草稿，可重新发送或修改后再发 |
| 实时更新 | 随会话快照变化即时刷新；切换会话自动清空旧数据 |
| 主题适配 | 全部使用主题 CSS 变量（`--dsw-alias-*`），浅色/深色均保持对比 |

## 目录结构

| 路径 | 形态 | 说明 |
| --- | --- | --- |
| `package.json` + `cordis.patch.yml` + `lib/index.js` + `client/client.js` | **静态 bundle（推荐）** | `dsh plugin add` 安装后随 profile 层栈自动加载，跨 DSH 进程存续 |
| `manifest.json` + `client-source.js` | 动态插件回退形态 | 仅用于无 bundle 能力的 profile，需在每次重启后重新 `cordis_define` / `cordis_run` |

## 安装与使用

### 静态 bundle（推荐）

```sh
# 本地目录安装（路径不能含空格；也可先发布到 npm）
dsh plugin --profile web add file:/path/to/sent-msg-locator

# 升级
dsh plugin --profile web update sent-msg-locator
```

安装后重启 DSH，打开任意会话，在标题栏点击「消息定位」即可使用。

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

- 数据来源：`useSession` 快照 → `snapshot.nodes` 过滤 `kind === 'user'`；
  若 `nodes` 不可用，兜底走增量 Chat 快照（`chat.order` + `chat.nodes.get`）。
  每项提取 `seq`（消息序号）/ `time`（Unix 毫秒）/ `content`（文本块拼接）。
- 会话桥：`conversation.input.dock` 内隐藏桥（渲染 null）捕获标准包
  `useSession` / `inputActions` / `useInput` 与 `sessionId`；切换会话时清空旧数据，
  避免面板展示上一个会话的消息。
- 回填语义：与 fexp-file-explorer 的「添加到聊天」一致 —— 追加到现有草稿、
  不覆盖；图片消息无可回填文本时按钮禁用。
- 面板入口与数据均走增量插槽（`conversation.session.header.actions` /
  `conversation.input.dock` / `shell.overlay`），不替换任何内置 UI。

## 开发约定

见 `AGENTS.md`（给 AI 代理与本仓库协作者的运行手册）。

## 版本历史

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0.0 | 2026-xx-xx | 首发：标题栏「消息定位」入口 + 右侧浮动面板，支持搜索、展开全文、回填输入框；纯 Client 实现，安全审查 ALLOW（0/300） |

## 安全说明

- 无 `spawn` / 网络请求 / 文件读写 / DOM 操作；客户端仅使用
  `ctx / React / styles / console` 内置能力。
- 声明能力：无（纯 UI）。静态审查判定 **ALLOW（0/300）**。
