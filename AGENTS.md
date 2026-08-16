# AGENTS.md — sent-msg-locator 已发送消息定位(DSH 动态 Cordis 插件)

给 AI 代理与本仓库协作者的运行手册。开始任何修改前请先读本文档。

## 项目是什么

`smsg` 是一个 DSH 纯 Client 插件:在会话标题栏提供「消息定位」入口,点击弹出右侧
浮动面板,列出当前会话中每次通过输入框发送的消息(序号/时间/摘要),支持搜索、
展开全文、一键回填输入框重新使用。数据来自会话快照的 `user` 节点,实时更新。

当前版本:`v1.0.0`(见 `manifest.json` 的 `version` 字段与 `README.md` 版本历史)。

## 文件结构与职责

| 文件 | 职责 | 修改时的注意 |
| --- | --- | --- |
| `client-source.js` | `cordis_define` 的 `code.client` 函数体原文(Client 半区 UI) | 改完必须同步重建插件,不能只改文件 |
| `manifest.json` | 插件元数据 + 恢复定义参数 + 版本号 | 版本号每次功能变更必须递增 |
| `lib/index.js` | 静态 bundle 形态的 Host 半区(最小空实现) | 本插件无 Host 能力;若新增 Host RPC 需同步加 webServer 路由 |
| `client/client.js` | 静态 bundle 形态的 Client 半区 | 与 `client-source.js` 逻辑一致(差异见文件头注释),改功能时两处必须同步 |
| `package.json` + `cordis.patch.yml` | 静态 bundle 安装配置 | bundle 形态是推荐形态 |
| `README.md` | 用户文档 + 恢复步骤 + 版本历史 | 版本历史表随每次发布追加 |
| `AGENTS.md` | 本文件,代理协作约定 | 约定变更时同步更新 |

> 本项目无 Host 半区能力,故不存在 `host-source.js`(动态形态 `code.host` 为 null)。
> 后续若引入 Host 能力,需同时补 `host-source.js` 并更新 `manifest.json` 的
> `code.host` 与 `purpose` 的 `CAPABILITIES:` 声明。

## 最重要的工作流:重建插件(DSH 重启后必做)

动态 Cordis 插件**不跨 DSH 进程存续**。DSH 重启后,仓库里的源码文件只是存档,
必须重新注册进当前进程:

1. 读取本目录 `client-source.js` 的完整内容;
2. 调用 `cordis_define`:
   - `plugin`: `{ "kind": "new", "idPrefix": "smsg" }`
   - `name`: `已发送消息定位`
   - `purpose`: `manifest.json` 中的 `purpose` 字段
   - `code.host`: `null`
   - `code.client`: `client-source.js` 的完整内容(函数体)
3. 调用 `cordis_run` 激活返回的 `pluginId`/`packageId`(首次需要用户批准)。

一句话提示词:「按 `sent-msg-locator` 目录重建已发送消息定位插件」。

## 修改工作流(改功能时)

1. **读档**:先读 `AGENTS.md`、`README.md`、`manifest.json` 和 `client-source.js`;
2. **改源码**:先改 `client-source.js`(动态形态存档、事实来源);
3. **同步静态形态**:把同样的改动同步到 `client/client.js`(静态 bundle 形态,
   差异仅为 `require('react')` / `insertCss` / 无 host.call);
4. **定义新 Package**:用 `cordis_define`(kind: `existing`,pluginId 为当前运行的
   插件 ID)追加新 Package,代码来自改后的 `client-source.js`;
5. **运行**:`cordis_run`(mode: `update`)切换到新 Package;
6. **同步文档**:功能变化时更新 `manifest.json`(version/purpose/slots/notes)
   与 `README.md`(功能描述/版本历史);
7. **提交**:git add + commit,提交信息遵循下面的约定。

> 不要只改源码文件而不重建插件,也不要只重建插件而不更新仓库存档 —— 两者必须一致。
> 静态与动态两份 Client 代码必须同步,否则 bundle 形态与回退形态行为不一致。

## 编码与架构约定

- **纯 Client**:只用**增量插槽**(`conversation.session.header.actions`、
  `conversation.input.dock`、`shell.overlay`),绝不替换内置 UI;纯 JS +
  `React.createElement`,禁 JSX/TS/import;不操作 `document`/`window`,不使用
  `setTimeout` 等全局(需定时器时走 `timer` 服务)。
- **数据来源**:会话快照 `useSession` → `snapshot.nodes` 过滤 `kind === 'user'`,
  兜底 `chat.order` + `chat.nodes.get`;只提取需要的叶子字段(seq/time/text/hasImage),
  不序列化快照对象本身。
- **会话作用域数据传递**:根作用域面板(overlay)拿不到 `useSession`,
  由 `conversation.input.dock` 隐藏桥(渲染 null)捕获并写入模块级状态;
  切换会话时必须清空旧数据。
- **回填语义**:追加到现有草稿、不覆盖(与 fexp 的「添加到聊天」一致);
  图片消息无可回填文本时按钮禁用。
- **主题适配**:颜色全部使用主题 CSS 变量(`--dsw-alias-*`),保证浅色/深色及
  任意主题下文字与背景都有对比;图标来自 Google Material Icons(Apache 2.0)。
- **安全红线**:不引入网络请求、不 spawn 进程、不声明 Host 能力;
  每次改动后过 `plugin_security_review`,保持 ALLOW 级(当前 0/300)。

## 版本管理约定

- 版本号统一存放在 `manifest.json` 的 `version` 字段,`README.md` 版本历史表同步登记;
- 语义化版本:`v1.0.0` 起,功能变更递增 minor,修复递增 patch;
- 提交信息用 Conventional Commits,中文描述:
  - `feat:` 新功能 / `fix:` 缺陷修复 / `docs:` 文档 / `refactor:` 重构 / `chore:` 杂项;
  - 示例:`feat: 面板支持按日期分组`、`fix: 切换会话后面板残留旧消息`、`docs: 新增 AGENTS.md 代理协作约定`;
- 每次功能提交保持仓库文件一致(源码 / manifest / README 版本历史 / 静态形态同步);
- `.gitattributes` 固定 `* text=auto eol=lf`,保持 LF 换行,勿引入 CRLF。

## 常用命令

- 查看状态:`git status` / `git log --oneline`
- 提交:`git add <files>` + `git commit -m "<type>: <中文描述>"`
- 安装静态形态:`dsh plugin --profile web add file:<本目录绝对路径>`
- 重建插件:见上文「最重要的工作流」
