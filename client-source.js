// ============================================================
// 已发送消息定位 (sent-msg-locator) — v2.0.0 (DSH 动态 Cordis 插件 · 回退形态)
// 本文件是 cordis_define 的 code.client 参数原文(函数体)。
//
// 功能: 定位当前会话中每一轮对话(用户发送 → 助手完整回复)。
//   - 对话区左缘浮动图标列 (shell.overlay): 每轮一个气泡序号图标,
//     点击平滑滚动定位到该轮开头, 当前浏览轮高亮联动, 随对话实时更新
//   - 隐藏数据桥 (conversation.input.dock, 渲染 0 尺寸元素):
//     捕获标准包 useSession 的 chat.timeline(官方 turnOrder + turns),
//     并实测对话区左缘坐标供图标列定位
//   - 轮尾锚点 (conversation.chat.assistant-actions, 渲染 0 尺寸元素):
//     每轮收尾助手消息处注册隐藏锚点, 供图标列点击滚动定位与当前轮检测
//
// 纯 Client 实现, 无 Host 半区(manifest 的 code.host 为 null):
//   - 数据来源: 会话快照 ConversationSnapshot.chat.timeline 的
//     turnOrder + turns(TurnLocation: turn/start/end/status)
//   - 滚动定位: 元素级 API(anchorElement.closest/getBoundingClientRect/
//     scrollTo), 不操作 document/window 全局, 不查询内置 DOM 结构
//   - 不引入网络、不 spawn 进程; 仅声明插槽能力
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
    const timer = ctx.get('timer')

    styles.insert(`
      .sml-rail {
        position: fixed; width: 40px; z-index: 900;
        display: flex; flex-direction: column; gap: 6px;
        padding: 6px 0;
        border-radius: 9px;
        background: var(--dsw-alias-bg-layer-1, rgba(148,163,184,.08));
        border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.28));
        box-shadow: 2px 0 10px rgba(0,0,0,.08);
        overflow-y: auto; overscroll-behavior: contain;
        pointer-events: auto;
      }
      .sml-rail-hint {
        display: flex; align-items: center; justify-content: center;
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        padding: 0 0 3px; user-select: none;
      }
      .sml-rail-item {
        display: flex; align-items: center; justify-content: center;
        width: 22px; height: 22px; margin: 0 auto; padding: 0;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 8px 8px 8px 2px; /* 气泡形: 左下小圆角模拟气泡尾巴 */
        background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.16));
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        font-size: 10.5px; font-weight: 600; line-height: 1;
        cursor: pointer; box-sizing: border-box;
        transition: background .15s ease, border-color .15s ease, color .15s ease;
      }
      .sml-rail-item:hover {
        border-color: var(--dsw-alias-brand-primary, rgba(124,176,255,.7));
        color: var(--dsw-alias-label-primary, #e8e8e8);
      }
      .sml-rail-item-current {
        background: var(--dsw-alias-brand-primary, #4c8dff);
        border-color: var(--dsw-alias-brand-primary, #4c8dff);
        color: #fff;
      }
      .sml-rail-item-open {
        border-style: dashed;
        opacity: .75;
      }
      .sml-rail-empty {
        text-align: center; font-size: 10px; line-height: 1.5;
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        padding: 4px 2px; user-select: none;
      }
    `)

    // --- 模块级轻量状态(useStore 模式, 与 fexp 一致) ---
    const listeners = new Set()
    let state = {
      sessionId: null,
      left: 0,            // 对话区左缘实测坐标(fixed 定位基准)
      turns: [],          // [{ turn, startTime, endTime, status }]
      turnUserKeys: new Map(), // turn -> 该轮第一条用户消息节点 key
      anchors: new Map(), // turn -> 轮尾锚点元素
      scrollEl: null,     // 聊天滚动容器(首个锚点建立监听)
      currentTurn: null,  // 当前浏览轮
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

    // --- 当前轮检测: 视口顶部之下第一个锚点所属轮 ---
    // 锚点位于各轮收尾, 从上到下按轮次排列; 视口顶部之下最近的
    // 锚点(即最小的 turn)就是用户当前正在浏览的轮。
    function computeCurrentTurn(el, anchors) {
      if (!el || !anchors.size) return null
      const top = el.getBoundingClientRect().top
      let cur = null
      for (const [turn, anchor] of anchors) {
        if (anchor.getBoundingClientRect().top >= top) {
          if (cur === null || turn < cur) cur = turn
        }
      }
      if (cur === null) {
        // 所有锚点都已滚过顶部(接近会话底部): 取最后一轮
        for (const turn of anchors.keys()) {
          if (cur === null || turn > cur) cur = turn
        }
      }
      return cur
    }

    function onScrollTick() {
      setState({ currentTurn: computeCurrentTurn(state.scrollEl, state.anchors) })
    }

    // --- 注册/注销轮尾锚点 ---
    function registerAnchor(turn, element) {
      const anchors = new Map(state.anchors)
      anchors.set(turn, element)
      const first = state.scrollEl === null
      setState({ anchors: anchors })
      if (first) {
        // 本元素所在的滚动祖先即聊天视口(元素级 closest, 不查询 document)
        const container = element.closest('[data-conversation-scroll]') || element.parentElement
        if (container && typeof container.addEventListener === 'function') {
          container.addEventListener('scroll', onScrollTick, { passive: true })
          setState({ scrollEl: container, currentTurn: computeCurrentTurn(container, anchors) })
        }
      }
    }

    function unregisterAnchor(turn, element) {
      if (state.anchors.get(turn) !== element) return
      const anchors = new Map(state.anchors)
      anchors.delete(turn)
      if (!anchors.size && state.scrollEl) {
        state.scrollEl.removeEventListener('scroll', onScrollTick)
        setState({ anchors: anchors, scrollEl: null, currentTurn: null })
      } else {
        setState({ anchors: anchors, currentTurn: computeCurrentTurn(state.scrollEl, anchors) })
      }
    }

    // --- 点击跳转: 精确滚动到该轮第一条用户消息(用户输入的文本位置) ---
    function jumpTo(turn, anchors, scrollEl, turnUserKeys) {
      const container = scrollEl || null
      if (!container || typeof container.scrollTo !== 'function') return
      let top = null
      // 优先: 该轮第一条用户消息节点行(data-chat-anchor-key = 快照节点 key,
      // 与内置聊天视图的锚点机制一致; 元素级 querySelectorAll, 不操作 document)
      const userKey = turnUserKeys && turnUserKeys.get(turn)
      if (userKey) {
        const rows = container.querySelectorAll('[data-chat-anchor-key]')
        for (const row of rows) {
          if (row.getAttribute('data-chat-anchor-key') === userKey) {
            top = row.getBoundingClientRect().top -
              container.getBoundingClientRect().top + container.scrollTop
            break
          }
        }
      }
      if (top === null) {
        // 兜底: 锚点元素位置(轮尾收尾消息处)
        const el = anchors.get(turn)
        if (!el) return
        if (turn <= 1) {
          top = 0
        } else {
          const prev = anchors.get(turn - 1)
          top = (prev || el).getBoundingClientRect().bottom -
            container.getBoundingClientRect().top + container.scrollTop
        }
      }
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }

    // --- 时间格式化(悬停提示) ---
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

    // --- 图标(Google Material Icons, Apache 2.0) ---
    function svgIcon(size, children) {
      return React.createElement('svg', {
        width: size || 16, height: size || 16, viewBox: '0 0 24 24',
        fill: 'currentColor',
        style: { flexShrink: 0, display: 'block' },
      }, children)
    }
    function IconChat(props) {
      // material chat: 会话气泡, 作为图标列顶部小图标。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M4 4h16v12H5.17L4 17.17V4m0-2c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H4zm2 10h8v2H6v-2zm0-3h12v2H6V9zm0-3h12v2H6V6z' }))
    }

    // --- 隐藏数据桥: 捕获 timeline 与对话区左缘坐标 ---
    function SessionBridge(props) {
      const useSession = props.useSession
      const sessionId = props.sessionId
      const snapshot = useSession ? useSession((s) => s) : undefined
      const ref = React.useRef(null)

      React.useEffect(() => {
        if (sessionId !== state.sessionId) {
          // 会话切换: 清空旧会话数据与锚点
          if (state.scrollEl) state.scrollEl.removeEventListener('scroll', onScrollTick)
          setState({
            sessionId: sessionId || null,
            left: 0,
            turns: [],
            turnUserKeys: new Map(),
            anchors: new Map(),
            scrollEl: null,
            currentTurn: null,
          })
        }
        // 提取轮次: 官方 timeline(turnOrder + turns)为主, 聊天节点快照兜底。
        // 会话历史分页(loadOlder)时 timeline 可能只含已加载窗口的轮次,
        // 而 chat.nodes 包含全部渲染节点 —— 两者合并保证轮次不缺失。
        const chat = snapshot && snapshot.chat
        const nodes = chat && chat.nodes
        const flowOrder = Array.isArray(chat.order) ? chat.order : []
        const timeline = chat && chat.timeline
        const tOrder = timeline && Array.isArray(timeline.turnOrder) ? timeline.turnOrder : []
        const tMap = timeline && timeline.turns

        const turnOfNode = (node) => {
          if (!node) return null
          const loc = node.location
          return loc && (loc.kind === 'turn' || loc.kind === 'step') && loc.turn
            ? loc.turn.turn
            : null
        }

        // 从节点推导的轮次信息(timeline 缺失时兜底)
        const nodeTurns = new Map() // turn -> { startTime, endTime, status }
        if (nodes && typeof nodes.get === 'function') {
          for (const key of flowOrder) {
            const node = nodes.get(key)
            const turnNo = turnOfNode(node)
            if (turnNo === null || nodeTurns.has(turnNo)) continue
            const loc = node.location.turn
            nodeTurns.set(turnNo, {
              startTime: loc.start && typeof loc.start.time === 'number'
                ? loc.start.time
                : typeof node.time === 'number' ? node.time : 0,
              endTime: loc.end && typeof loc.end.time === 'number' ? loc.end.time : 0,
              status: loc.status,
            })
          }
        }

        // 合并顺序: timeline order 优先, 再按节点渲染顺序补全
        const order = []
        const seen = new Set()
        for (const turnNo of tOrder) {
          if (!seen.has(turnNo)) {
            seen.add(turnNo)
            order.push(turnNo)
          }
        }
        if (nodes && typeof nodes.get === 'function') {
          for (const key of flowOrder) {
            const turnNo = turnOfNode(nodes.get(key))
            if (turnNo !== null && !seen.has(turnNo)) {
              seen.add(turnNo)
              order.push(turnNo)
            }
          }
        }

        const turns = []
        const turnUserKeys = new Map()
        if (order.length) {
          // 该轮第一条用户消息节点 key: 遍历 chat.order(渲染顺序),
          // 节点 location 属于该轮且 kind === 'user' 的第一个
          const userKeyByTurn = new Map()
          if (nodes && typeof nodes.get === 'function') {
            for (const key of flowOrder) {
              const node = nodes.get(key)
              if (!node || node.kind !== 'user') continue
              const turnNo = turnOfNode(node)
              if (turnNo === null || userKeyByTurn.has(turnNo)) continue
              userKeyByTurn.set(turnNo, key)
            }
          }
          for (const turnNo of order) {
            const loc = tMap && typeof tMap.get === 'function' ? tMap.get(turnNo) : undefined
            const nodeInfo = nodeTurns.get(turnNo)
            turns.push({
              turn: turnNo,
              startTime: loc && loc.start && typeof loc.start.time === 'number'
                ? loc.start.time
                : nodeInfo ? nodeInfo.startTime : 0,
              endTime: loc && loc.end && typeof loc.end.time === 'number'
                ? loc.end.time
                : nodeInfo ? nodeInfo.endTime : 0,
              status: loc ? loc.status : nodeInfo ? nodeInfo.status : 'unknown',
            })
            const userKey = userKeyByTurn.get(turnNo)
            if (userKey) turnUserKeys.set(turnNo, userKey)
          }
        }
        setState({ turns: turns, turnUserKeys: turnUserKeys })
      }, [snapshot, sessionId])

      React.useEffect(() => {
        // 实测对话区左缘坐标(元素级 rect, 不触碰 document/window 全局)。
        // 侧边栏可折叠/拖拽改变宽度, 用 timer 轮询持续校准, 保证图标列
        // 始终贴在侧边栏右缘(对话区左缘)右侧。
        const measure = () => {
          if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            if (Math.abs(rect.left - state.left) > 0.5) setState({ left: rect.left })
          }
        }
        measure()
        if (timer && typeof timer.interval === 'function') {
          return timer.interval(measure, 300)
        }
        return undefined
      }, [snapshot])

      return React.createElement('div', { ref: ref, style: { width: 0, height: 0 } })
    }

    // --- 轮尾锚点: 每轮收尾助手消息处注册隐藏锚点 ---
    function TurnAnchor(props) {
      const useSession = props.useSession
      const messageId = props.messageId
      const ref = React.useRef(null)
      const [turn, setTurn] = React.useState(null)
      // useSession 是标准包 hook, 必须在组件顶层调用(不能在 effect 内调用)
      const snapshot = useSession ? useSession((s) => s) : undefined

      // 通过 messageId 反查该消息所属轮次(快照节点 data.turn / location.turn)
      React.useEffect(() => {
        const chat = snapshot && snapshot.chat
        const nodes = chat && chat.nodes
        if (!nodes || typeof nodes.get !== 'function') return
        let found = null
        // chat.order 为渲染顺序; 找到携带该 messageId 的收尾助手节点
        const order = Array.isArray(chat.order) ? chat.order : []
        for (const key of order) {
          const node = nodes.get(key)
          if (!node) continue
          const data = node.data
          const finalNode = data && data.finalNode
          if (data && (finalNode && finalNode.messageId === messageId ||
            data.message && data.message.id === messageId)) {
            found = node
            break
          }
        }
        if (!found) return
        const data = found.data || {}
        // assistant-step 节点 data.turn 为轮次序号; 兜底走 location
        const turnNo = typeof data.turn === 'number' ? data.turn : null
        const resolved = turnNo !== null ? turnNo : (() => {
          const loc = found.location
          return loc && (loc.kind === 'turn' || loc.kind === 'step') && loc.turn
            ? loc.turn.turn
            : null
        })()
        if (resolved !== null && resolved !== turn) setTurn(resolved)
      }, [messageId, snapshot])

      React.useEffect(() => {
        if (turn === null || !ref.current) return
        const el = ref.current
        registerAnchor(turn, el)
        return () => unregisterAnchor(turn, el)
      }, [turn])

      return React.createElement('div', { ref: ref, style: { width: 0, height: 0, display: 'inline-block' } })
    }

    // --- 左侧图标列 ---
    function TurnRail() {
      const left = useStore((s) => s.left)
      const turns = useStore((s) => s.turns)
      const anchors = useStore((s) => s.anchors)
      const scrollEl = useStore((s) => s.scrollEl)
      const turnUserKeys = useStore((s) => s.turnUserKeys)
      const currentTurn = useStore((s) => s.currentTurn)
      const railRef = React.useRef(null)

      // 当前轮变化时, 图标列自动滚动使高亮图标可见
      React.useEffect(() => {
        if (currentTurn === null || !railRef.current) return
        const el = railRef.current.querySelector('[data-sml-turn="' + currentTurn + '"]')
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' })
        }
      }, [currentTurn])

      if (!left) return null

      const items = turns.map((t) => {
        const isCurrent = currentTurn === t.turn
        const clickable = anchors.has(t.turn) || turnUserKeys.has(t.turn)
        const cls = ['sml-rail-item']
        if (isCurrent) cls.push('sml-rail-item-current')
        if (t.status === 'open') cls.push('sml-rail-item-open')
        const title = '第 ' + t.turn + ' 轮' + (t.startTime ? ' · ' + fmtTime(t.startTime) : '') +
          (t.status === 'open' ? ' · 进行中' : '') +
          (clickable ? '' : ' · 暂不可定位')
        return React.createElement('button', {
          key: t.turn,
          type: 'button',
          className: cls.join(' '),
          title: title,
          'data-sml-turn': String(t.turn),
          'aria-label': title,
          disabled: !clickable,
          onClick: () => jumpTo(t.turn, anchors, scrollEl, turnUserKeys),
        }, String(t.turn))
      })

      return React.createElement('div', {
        ref: railRef,
        className: 'sml-rail',
        style: { left: left + 14, top: 96, bottom: 130 },
      },
        React.createElement('div', { className: 'sml-rail-hint' },
          React.createElement(IconChat, { size: 11 })),
        turns.length ? items : React.createElement('div', { className: 'sml-rail-empty' }, '暂无'),
      )
    }

    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'smsg-session-bridge', order: 0, label: '已发送消息定位·数据桥' },
      (props) => React.createElement(SessionBridge, {
        useSession: props && props.useSession,
        sessionId: props && props.sessionId,
      }),
    ))

    slots.inject('conversation.chat.assistant-actions', () => slots.register(
      { name: 'conversation.chat.assistant-actions', id: 'smsg-turn-anchor', order: 50, label: '已发送消息定位·轮尾锚点' },
      (props) => React.createElement(TurnAnchor, {
        useSession: props && props.useSession,
        messageId: props && props.messageId,
      }),
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'smsg-panel', order: 20 },
      () => React.createElement(TurnRail, null),
    ))
  },
}
