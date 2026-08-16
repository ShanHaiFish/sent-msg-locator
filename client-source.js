// ============================================================
// 已发送消息定位 (sent-msg-locator) — v1.0.0 (DSH 动态 Cordis 插件 · 回退形态)
// 本文件是 cordis_define 的 code.client 参数原文(函数体)。
//
// 功能: 定位当前会话中每次通过输入框发送的消息。
//   - 会话标题栏「消息定位」按钮 (conversation.session.header.actions)
//   - 隐藏输入桥 (conversation.input.dock, 渲染 null): 捕获标准包
//     useSession / inputActions / useInput, 供面板使用
//   - 右侧 360px 浮动面板 (shell.overlay): 列出全部已发送消息
//     (序号 #N / 时间 / 摘要), 支持关键词搜索、点击展开全文、
//     一键把消息内容回填到聊天输入框重新使用; 随发送实时更新
//
// 纯 Client 实现, 无 Host 半区(manifest 的 code.host 为 null):
//   - 数据来源: 会话快照 ConversationSnapshot.nodes 中 kind==='user' 的节点
//     (UserMessageNode: seq / time / content), 兜底走 chat.order + chat.nodes
//   - 不引入网络、不 spawn 进程、不操作 DOM/window; 仅声明插槽能力
//
// 编码约定(与 fexp-file-explorer 一致):
//   - 纯 JS + React.createElement, 无 JSX/TS/import
//   - 主题适配: 颜色全部使用主题 CSS 变量(--dsw-alias-*), 深浅色均可见
//   - 图标来自 Google Material Icons 官方库 (Apache 2.0 许可,
//     @material-design-icons/svg outlined 变体, https://fonts.google.com/icons)
// ============================================================
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
      .sml-entry-btn {
        display: inline-flex; align-items: center; gap: 5px;
        height: 28px; padding: 0 10px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 7px;
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.14));
        color: var(--dsw-alias-label-primary, #333a44);
        font-size: 12px; white-space: nowrap; cursor: pointer;
        box-sizing: border-box; margin: 2px;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
      }
      .sml-entry-btn:hover {
        border-color: var(--dsw-alias-brand-primary, rgba(124,176,255,.7));
        background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.22));
      }
      .sml-entry-btn-active {
        color: var(--dsw-alias-brand-primary, #4c8dff);
        border-color: var(--dsw-alias-brand-primary, #4c8dff);
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.14));
      }
      .sml-entry-count {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 16px; height: 16px; padding: 0 4px;
        border-radius: 8px;
        background: var(--dsw-alias-brand-primary, #4c8dff);
        color: #fff; font-size: 10.5px; font-weight: 600; line-height: 1;
      }

      .sml-panel {
        position: fixed; right: 0; top: 0; bottom: 0; width: 360px; z-index: 1000;
        display: flex; flex-direction: column;
        background: var(--dsw-alias-bg-base, #101318);
        border-left: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        box-shadow: -10px 0 28px rgba(0,0,0,.22);
        color: var(--dsw-alias-label-primary, #e8e8e8);
        font-size: 13px; line-height: 1.45; pointer-events: auto;
      }
      .sml-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; }
      .sml-head-icon { display: flex; color: var(--dsw-alias-brand-primary, #4c8dff); }
      .sml-head-title { flex: 1; font-weight: 600; font-size: 13px; }

      .sml-tbtn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 26px; height: 26px; padding: 0;
        border: 1px solid transparent; border-radius: 6px;
        background: transparent; color: var(--dsw-alias-label-secondary, #9aa4b2);
        cursor: pointer;
      }
      .sml-tbtn:hover:not(:disabled) {
        background: var(--dsw-alias-bg-layer-1, rgba(255,255,255,.06));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .sml-tbtn:disabled { opacity: .35; cursor: default; }

      .sml-search { padding: 2px 10px 8px; }
      .sml-search-wrap { position: relative; display: flex; align-items: center; }
      .sml-search-icon {
        position: absolute; left: 8px; display: flex;
        color: var(--dsw-alias-label-secondary, #9aa4b2); pointer-events: none;
      }
      .sml-search-input {
        width: 100%; box-sizing: border-box;
        padding: 6px 8px 6px 28px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 6px;
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.14));
        color: var(--dsw-alias-label-primary, #333a44);
        font-size: 12px; outline: none;
      }
      .sml-search-input::placeholder { color: var(--dsw-alias-label-secondary, #9aa4b2); }
      .sml-search-input:focus { border-color: var(--dsw-alias-brand-primary, rgba(124,176,255,.7)); }

      .sml-body { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
      .sml-empty {
        padding: 18px 10px; text-align: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 12px;
      }

      .sml-item {
        margin-bottom: 6px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        border-radius: 8px; overflow: hidden;
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.08));
      }
      .sml-row {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 10px; cursor: pointer; user-select: none;
      }
      .sml-row:hover { background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.14)); }
      .sml-idx {
        flex-shrink: 0; min-width: 30px; text-align: center;
        padding: 1px 5px; border-radius: 5px;
        background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.2));
        color: var(--dsw-alias-brand-primary, #4c8dff);
        font-size: 11px; font-weight: 600;
      }
      .sml-time { flex-shrink: 0; color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11px; }
      .sml-preview {
        flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 12.5px; color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .sml-img-mark { flex-shrink: 0; display: inline-flex; color: var(--dsw-alias-label-secondary, #9aa4b2); }
      .sml-chevron {
        flex-shrink: 0; display: inline-flex;
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        transition: transform .15s ease;
      }
      .sml-chevron-open { transform: rotate(180deg); }

      .sml-detail {
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        padding: 8px 10px;
        background: var(--dsw-alias-bg-base, #101318);
      }
      .sml-full {
        margin: 0 0 8px; max-height: 240px; overflow: auto;
        white-space: pre-wrap; word-break: break-word;
        font-family: inherit; font-size: 12.5px; line-height: 1.55;
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .sml-actions { display: flex; gap: 6px; }
      .sml-refill-btn {
        display: inline-flex; align-items: center; gap: 4px;
        height: 22px; padding: 0 8px;
        border: 1px solid rgba(124,176,255,.45); border-radius: 5px;
        background: rgba(124,176,255,.12);
        color: var(--dsw-alias-brand-primary, #7cb0ff);
        font-size: 11.5px; white-space: nowrap; cursor: pointer;
      }
      .sml-refill-btn:hover:not(:disabled) { background: rgba(124,176,255,.24); }
      .sml-refill-btn:disabled { opacity: .45; cursor: default; }

      .sml-foot {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 12px 10px;
        border-top: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35));
        color: var(--dsw-alias-label-secondary, #9aa4b2); font-size: 11.5px;
      }
      .sml-foot strong { color: var(--dsw-alias-label-primary, #e8e8e8); font-weight: 600; }
    `)

    // --- 模块级轻量状态(useStore 模式, 与 fexp 一致) ---
    const listeners = new Set()
    let state = {
      open: false,
      query: '',
      expandedSeq: null,
      sessionId: null,
      messages: [],        // [{ seq, time, text, hasImage }]
      inputActions: null,  // 标准包 InputActions(setDraft), 供回填使用
      chatDraft: '',
    }

    function setState(patch) {
      state = Object.assign({}, state, patch)
      listeners.forEach((fn) => { try { fn() } catch (e) { /* noop */ } })
    }

    function useStore(selector) {
      const [value, setValue] = React.useState(() => selector(state))
      React.useEffect(() => {
        const fn = () => setValue(selector(state))
        listeners.add(fn)
        // Self-heal: 订阅后立即重读当前状态, 避免订阅前的更新丢失。
        setValue(selector(state))
        return () => listeners.delete(fn)
      }, [])
      return value
    }

    // --- 数据派生: 从会话快照提取用户发送的消息 ---
    function textOf(content) {
      if (!Array.isArray(content)) return ''
      let text = ''
      for (const block of content) {
        if (block && block.type === 'text' && typeof block.text === 'string') {
          text += (text ? '\n' : '') + block.text
        }
      }
      return text
    }

    function hasImageOf(content) {
      return Array.isArray(content) && content.some((block) => block && block.type === 'image')
    }

    function collectMessages(snapshot) {
      if (!snapshot) return []
      let nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : null
      if (!nodes) {
        // 兜底: 走增量 Chat 快照(chat.order + chat.nodes.get)
        const chat = snapshot.chat
        if (chat && Array.isArray(chat.order) && chat.nodes && typeof chat.nodes.get === 'function') {
          const out = []
          for (const key of chat.order) {
            const node = chat.nodes.get(key)
            if (node && node.kind === 'user') out.push(node)
          }
          nodes = out
        }
      }
      if (!nodes) return []
      const out = []
      for (const node of nodes) {
        if (!node || node.kind !== 'user') continue
        out.push({
          seq: typeof node.seq === 'number' ? node.seq : 0,
          time: typeof node.time === 'number' ? node.time : 0,
          text: textOf(node.content),
          hasImage: hasImageOf(node.content),
        })
      }
      return out
    }

    // --- 时间/摘要格式化 ---
    function fmtTime(ms) {
      if (!ms) return ''
      const d = new Date(ms)
      const now = new Date()
      const pad = (x) => String(x).padStart(2, '0')
      const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
      const sameDay = d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
      if (sameDay) return hm
      const md = (d.getMonth() + 1) + '-' + d.getDate()
      if (d.getFullYear() === now.getFullYear()) return md + ' ' + hm
      return d.getFullYear() + '-' + md + ' ' + hm
    }

    function previewOf(m) {
      const line = m.text.split('\n').find((l) => l.trim() !== '')
      const flat = (line || m.text).replace(/\s+/g, ' ').trim()
      if (flat) return flat.length > 60 ? flat.slice(0, 60) + '…' : flat
      return m.hasImage ? '[图片]' : '（空消息）'
    }

    // --- 回填输入框: 把消息内容放入 composer 草稿(不覆盖已有内容) ---
    function refillToInput(m) {
      const actions = state.inputActions
      if (!actions || !m.text) return
      const base = (state.chatDraft || '').trim()
      actions.setDraft(base ? base + '\n' + m.text : m.text)
    }

    // --- 图标(Google Material Icons, Apache 2.0) ---
    function svgIcon(size, children) {
      return React.createElement('svg', {
        width: size || 16, height: size || 16, viewBox: '0 0 24 24',
        fill: 'currentColor',
        style: { flexShrink: 0, display: 'block' },
      }, children)
    }
    function IconChat(props) {
      // material chat: 会话气泡, 作为入口与面板图标。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M4 4h16v12H5.17L4 17.17V4m0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h8v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z' }))
    }
    function IconClose(props) {
      // material close: 关闭面板。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z' }))
    }
    function IconSearch(props) {
      // material search: 搜索放大镜。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z' }))
    }
    function IconRefill(props) {
      // material reply: 回填(把历史消息放回输入框)。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z' }))
    }
    function IconImage(props) {
      // material image: 图片消息标记。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' }))
    }
    function IconChevron(props) {
      // material expand_more: 展开/收起指示。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z' }))
    }

    // --- 隐藏输入桥: 会话作用域, 捕获标准包数据供根作用域面板使用 ---
    function SessionBridge(props) {
      const useSession = props.useSession
      const useInput = props.useInput
      const actions = props.inputActions
      const sessionId = props.sessionId
      const snapshot = useSession ? useSession((s) => s) : undefined

      React.useEffect(() => {
        if (sessionId !== state.sessionId) {
          setState({ sessionId: sessionId || null, expandedSeq: null })
        }
        setState({ messages: collectMessages(snapshot) })
      }, [snapshot, sessionId])

      const draft = useInput ? useInput((s) => s.draft) : undefined
      React.useEffect(() => {
        setState({ inputActions: actions || null })
        return () => {
          if (actions && state.inputActions === actions) setState({ inputActions: null })
        }
      }, [actions])
      React.useEffect(() => {
        setState({ chatDraft: draft || '' })
      }, [draft])

      React.useEffect(() => {
        // 会话切换/卸载: 清空本会话数据, 避免面板展示上一个会话的消息。
        return () => setState({ messages: [], inputActions: null })
      }, [])
      return null
    }

    // --- 标题栏「消息定位」入口按钮 ---
    function HeaderToggle(props) {
      const open = useStore((s) => s.open)
      const count = useStore((s) => s.messages.length)
      return React.createElement('button', {
        type: 'button',
        className: open ? 'sml-entry-btn sml-entry-btn-active' : 'sml-entry-btn',
        title: '定位已发送消息',
        'aria-label': '消息定位',
        onClick: () => setState({ open: !open }),
      }, React.createElement(IconChat, { size: 16 }),
        React.createElement('span', null, '消息定位'),
        count ? React.createElement('span', { className: 'sml-entry-count' }, String(count)) : null)
    }

    // --- 右侧浮动定位面板 ---
    function LocatorPanel(props) {
      const open = useStore((s) => s.open)
      const query = useStore((s) => s.query)
      const expandedSeq = useStore((s) => s.expandedSeq)
      const messages = useStore((s) => s.messages)
      const inputActions = useStore((s) => s.inputActions)

      if (!open) return null

      const q = query.trim().toLowerCase()
      const filtered = []
      messages.forEach((m, i) => {
        const index = i + 1
        if (q && m.text.toLowerCase().indexOf(q) < 0 && String(index).indexOf(q) < 0) return
        filtered.push({ index: index, seq: m.seq, time: m.time, text: m.text, hasImage: m.hasImage })
      })
      const rows = filtered.slice().reverse() // 最新在前, 便于快速回顾

      const items = rows.map((m) => {
        const isOpen = expandedSeq === m.seq
        const fullText = m.text || (m.hasImage ? '（该消息仅包含图片，无文本内容）' : '（空消息）')
        return React.createElement('div', { key: m.seq, className: 'sml-item' },
          React.createElement('div', {
            className: 'sml-row',
            title: isOpen ? '收起' : '展开查看全文',
            onClick: () => setState({ expandedSeq: isOpen ? null : m.seq }),
          },
            React.createElement('span', { className: 'sml-idx' }, '#' + m.index),
            React.createElement('span', { className: 'sml-time' }, fmtTime(m.time)),
            React.createElement('span', { className: 'sml-preview' }, previewOf(m)),
            m.hasImage ? React.createElement('span', { className: 'sml-img-mark', title: '含图片' }, React.createElement(IconImage, { size: 13 })) : null,
            React.createElement('span', { className: isOpen ? 'sml-chevron sml-chevron-open' : 'sml-chevron' }, React.createElement(IconChevron, { size: 14 }))),
          isOpen ? React.createElement('div', { className: 'sml-detail' },
            React.createElement('pre', { className: 'sml-full' }, fullText),
            React.createElement('div', { className: 'sml-actions' },
              React.createElement('button', {
                type: 'button', className: 'sml-refill-btn',
                title: inputActions && m.text ? '把这条消息的内容放回聊天输入框' : '当前没有可用的会话输入框，或该消息没有可回填的文本',
                disabled: !inputActions || !m.text,
                onClick: () => refillToInput(m),
              }, React.createElement(IconRefill, { size: 13 }),
                React.createElement('span', null, '回填输入框')))) : null)
      })

      let bodyEl
      if (!messages.length) {
        bodyEl = React.createElement('div', { className: 'sml-empty' },
          '本会话还没有发送过消息')
      } else if (!items.length) {
        bodyEl = React.createElement('div', { className: 'sml-empty' },
          '没有匹配「' + query.trim() + '」的消息')
      } else {
        bodyEl = React.createElement('div', null, items)
      }

      return React.createElement('div', { className: 'sml-panel' },
        React.createElement('div', { className: 'sml-head' },
          React.createElement('span', { className: 'sml-head-icon' }, React.createElement(IconChat, { size: 16 })),
          React.createElement('span', { className: 'sml-head-title' }, '已发送消息'),
          React.createElement('button', {
            type: 'button', className: 'sml-tbtn', title: '关闭面板',
            onClick: () => setState({ open: false }),
          }, React.createElement(IconClose, null))),
        React.createElement('div', { className: 'sml-search' },
          React.createElement('div', { className: 'sml-search-wrap' },
            React.createElement('span', { className: 'sml-search-icon' }, React.createElement(IconSearch, { size: 14 })),
            React.createElement('input', {
              type: 'text', className: 'sml-search-input',
              placeholder: '搜索已发送的消息内容…',
              value: query,
              onChange: (e) => setState({ query: e.target.value }),
            }))),
        React.createElement('div', { className: 'sml-body' }, bodyEl),
        React.createElement('div', { className: 'sml-foot' },
          React.createElement('span', null, '共'),
          React.createElement('strong', null, String(messages.length)),
          React.createElement('span', null, '条已发送消息 · 点击条目展开全文，可回填输入框重新使用')))
    }

    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'smsg-header-toggle', order: 40, label: '消息定位' },
      () => React.createElement(HeaderToggle, null),
    ))

    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'smsg-session-bridge', order: 0, label: '已发送消息定位·会话桥' },
      (props) => React.createElement(SessionBridge, {
        useSession: props && props.useSession,
        useInput: props && props.useInput,
        inputActions: props && props.inputActions,
        sessionId: props && props.sessionId,
      }),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'smsg-panel', order: 20 },
      () => React.createElement(LocatorPanel, null),
    ))
  },
}
