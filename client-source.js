// ============================================================
// 已发送消息定位 (sent-msg-locator) — v2.3.1 (DSH 动态 Cordis 插件 · 回退形态)
// 本文件是 cordis_define 的 code.client 参数原文(函数体)。
//
// 功能: 定位当前会话中每一轮对话(用户发送 → 助手完整回复)。
//   - 对话区左缘浮动图标列 (shell.overlay): 每轮一个气泡序号图标,
//     点击平滑滚动定位到该轮开头, 当前浏览轮高亮联动, 随对话实时更新
//   - 悬停提示卡: 自定义 fixed 定位圆角卡片(替代原生 title), 显示
//     第 N 轮 · 时间(· 进行中)与该轮第一条用户消息的文本内容,
//     超长文本最多 6 行截断(280px 宽), 键盘聚焦同样显示
//   - 隐藏数据桥 (conversation.input.dock, 渲染 0 尺寸元素):
//     捕获标准包 useSession 的 chat.timeline(官方 turnOrder + turns),
//     并实测对话区左缘坐标供图标列定位
//   - 轮尾锚点 (conversation.chat.assistant-actions, 渲染 0 尺寸元素):
//     每轮收尾助手消息处注册隐藏锚点, 供图标列点击滚动定位与当前轮检测
//   - 压缩分隔标记: 官方 compaction 检查点节点(kind === 'compaction')
//     存在时, 图标列顶部显示压缩图标 + 虚线分隔, 悬停提示被压缩的
//     历史记录条数 / token 数; 被压缩轮次自动从图标列消失
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
        /* 竖条本体全透明: 调整窗口宽度时图标列可能与对话文字重叠,
           去掉背景/边框/阴影后不遮挡文本; 只有气泡图标保留视觉。 */
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
        width: 17.6px; height: 17.6px; margin: 0 auto; padding: 0;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 6.4px 6.4px 6.4px 1.6px; /* 气泡形: 左下小圆角模拟气泡尾巴 */
        background: var(--dsw-alias-bg-layer-2, rgba(148,163,184,.16));
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        font-size: 8.4px; font-weight: 600; line-height: 1;
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
        /* 数字可读性: 按品牌色亮度自动取黑/白文字(contrast-color),
           避免浅色品牌主题下白色数字看不清; 不支持时退回 #fff */
        color: #fff;
        color: contrast-color(var(--dsw-alias-brand-primary, #4c8dff));
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
      .sml-rail-compact {
        display: flex; align-items: center; justify-content: center;
        gap: 3px; margin: 0 3px 3px; padding: 0 0 5px;
        border-bottom: 1px dashed var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        user-select: none; cursor: default;
      }
      /* 悬停提示卡: 自定义 fixed 定位(原生 title 无法限制尺寸/加圆角),
         显示在图标右侧, 圆角卡片 + 主题变量适配深浅色; 文本最长 6 行截断 */
      .sml-tip {
        position: fixed; z-index: 950;
        max-width: 280px; box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(120,130,145,.45));
        border-radius: 10px;
        background: var(--dsw-alias-bg-layer-3, #1d2027);
        box-shadow: var(--dsw-shadow-lv1, 0 2px 4px rgba(0,0,0,.05));
        color: var(--dsw-alias-label-primary, #e8e8e8);
        font-size: 12px; line-height: 1.5;
        pointer-events: none; user-select: none;
        transform: translateY(-50%);
        overflow: hidden;
      }
      .sml-tip-head {
        color: var(--dsw-alias-label-secondary, #9aa4b2);
        font-size: 11px; line-height: 1.4;
        margin: 0 0 4px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .sml-tip-text {
        margin: 0;
        color: var(--dsw-alias-label-primary, #e8e8e8);
        white-space: pre-wrap; overflow-wrap: anywhere;
        /* 超长文本: 最多 6 行省略号截断(line-clamp), max-height 兜底 */
        max-height: 108px; overflow: hidden;
        display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical;
      }
    `)

    // --- 模块级轻量状态(useStore 模式, 与 fexp 一致) ---
    const listeners = new Set()
    let state = {
      sessionId: null,
      left: 0,            // 对话区左缘实测坐标(fixed 定位基准)
      turns: [],          // [{ turn, startTime, endTime, status }]
      turnUserKeys: new Map(), // turn -> 该轮第一条用户消息节点 key
      turnTexts: new Map(), // turn -> 该轮第一条用户消息的文本(悬停提示卡)
      anchors: new Map(), // turn -> 轮尾锚点元素
      scrollEl: null,     // 聊天滚动容器(首个锚点建立监听)
      currentTurn: null,  // 当前浏览轮
      compaction: null,   // 压缩标记: { items, tokens } | null
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

    // --- 压缩计数格式化(悬停提示) ---
    function fmtTokens(n) {
      if (typeof n !== 'number' || !isFinite(n)) return ''
      if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
      if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
      return String(n)
    }

    // --- 用户消息文本提取(悬停提示卡) ---
    // user 节点 data.content 为 ContentBlock[]: { type: 'text', text } 是
    // 文本块, { type: 'image' } 是图片块; 只拼接文本块, 纯图片消息给占位。
    // JS 侧 400 码点安全上限(正常截断由 CSS 6 行/280px 完成, 上限仅防
    // 粘贴超大文本撑爆 DOM)。
    function extractUserText(node) {
      const data = node && node.data
      const content = data && Array.isArray(data.content) ? data.content : []
      let text = ''
      let hasImage = false
      for (const block of content) {
        if (!block) continue
        if (block.type === 'text' && typeof block.text === 'string') text += block.text
        else if (block.type === 'image') hasImage = true
      }
      if (!text && hasImage) return '[图片]'
      if (text.length > 400) return [...text].slice(0, 400).join('') + '…'
      return text
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
    function IconCompress(props) {
      // material compress: 上下箭头对拢 + 中横线, 作为压缩分隔标记小图标。
      return svgIcon(props && props.size,
        React.createElement('path', { d: 'M8 19h3v3h2v-3h3l-4-4-4 4zm8-14h-3V2h-2v3H8l4 4 4-4zM4 9v2h16V9H4z' }))
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
            turnTexts: new Map(),
            anchors: new Map(),
            scrollEl: null,
            currentTurn: null,
            compaction: null,
          })
        }
        // 数据桥绝不能抛错: 插槽系统会把一次渲染错误永久弃权, 图标列
        // 随之彻底消失(v2.3.0 教训)。快照在加载/流式/压缩各阶段形状
        // 多变, 推导整体包 try/catch, 异常时跳过本次推导并告警。
        try {
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
        // 注意: userTextByTurn 必须在 if (order.length) 之外声明 ——
        // setState 在块外引用它; 若在块内声明, 空会话(order 为空,
        // 空白会话/快照加载中)时 ReferenceError 会导致数据桥被
        // 插槽系统永久弃权, 图标列彻底消失(v2.3.0 事故根因)
        const userTextByTurn = new Map()
        if (order.length) {
          // 该轮第一条用户消息节点 key 与文本: 遍历 chat.order(渲染顺序),
          // 节点 location 属于该轮且 kind === 'user' 的第一个
          const userKeyByTurn = new Map()
          if (nodes && typeof nodes.get === 'function') {
            for (const key of flowOrder) {
              const node = nodes.get(key)
              if (!node || node.kind !== 'user') continue
              const turnNo = turnOfNode(node)
              if (turnNo === null || userKeyByTurn.has(turnNo)) continue
              userKeyByTurn.set(turnNo, key)
              userTextByTurn.set(turnNo, extractUserText(node))
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
        // 压缩标记: 官方 compaction 检查点节点(kind === 'compaction',
        // 由视图层把替换摘要的 user/message 渲染成标记行)。被压缩的旧轮次
        // 已从表层移除(timeline 与 nodes 均不含), 图标自动消失; 此处仅
        // 提取计数叶子字段, 供图标列顶部渲染压缩分隔标记。
        let compaction = null
        if (nodes && typeof nodes.get === 'function') {
          for (const key of flowOrder) {
            const node = nodes.get(key)
            if (!node || node.kind !== 'compaction') continue
            const d = node.data || {}
            compaction = {
              items: typeof d.shadowedItemCount === 'number' ? d.shadowedItemCount : null,
              tokens: typeof d.shadowedTokenCount === 'number' ? d.shadowedTokenCount : null,
            }
            break
          }
        }
        setState({ turns: turns, turnUserKeys: turnUserKeys, turnTexts: userTextByTurn, compaction: compaction })
        } catch (e) {
          // 跳过本次推导: 宁可暂时无数据, 也不能让桥崩溃弃权
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('[smsg] 会话快照推导异常, 已跳过:', e)
          }
        }
      }, [snapshot, sessionId])

      React.useEffect(() => {
        // 实测对话区左缘坐标(元素级 rect, 不触碰 document/window 全局)。
        // 侧边栏可折叠/拖拽改变宽度, 用 timer 轮询持续校准, 保证图标列
        // 始终贴在侧边栏右缘(对话区左缘)右侧。
        // 基准必须是聊天滚动容器 [data-conversation-scroll](scrollBody):
        // 空白会话 hero 阶段(点击工作区开始新会话、发送第一条消息前后)
        // composer 输入区是居中受限宽度(约 812px)的, dock 行左缘会随
        // 输入框居中而远离侧边栏(图标列会悬浮到输入框上); 滚动容器横跨
        // 整个会话列, 其左缘在 hero/active/settling 各阶段都等于对话区左缘。
        const measure = () => {
          if (ref.current) {
            const scroller = ref.current.closest('[data-conversation-scroll]')
            const el = scroller || ref.current
            const rect = el.getBoundingClientRect()
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
      const turnTexts = useStore((s) => s.turnTexts)
      const currentTurn = useStore((s) => s.currentTurn)
      const compaction = useStore((s) => s.compaction)
      const railRef = React.useRef(null)
      const tipElRef = React.useRef(null)
      const [tipTurn, setTipTurn] = React.useState(null) // 正在悬停/聚焦的轮次
      const [tipPos, setTipPos] = React.useState(null)   // 提示卡 fixed 坐标 { x, y }

      // 当前轮变化时, 图标列自动滚动使高亮图标可见
      React.useEffect(() => {
        if (currentTurn === null || !railRef.current) return
        const el = railRef.current.querySelector('[data-sml-turn="' + currentTurn + '"]')
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' })
        }
      }, [currentTurn])

      // 会话切换(left 归零)时清空悬停提示
      React.useEffect(() => {
        if (!left && tipTurn !== null) {
          tipElRef.current = null
          setTipTurn(null)
          setTipPos(null)
        }
      }, [left])

      // 提示卡定位: 悬停按钮 rect 右侧固定定位(元素级 API, 不触碰全局);
      // 显示期间 timer 轮询校准(侧边栏拖拽/图标列内部滚动时提示卡跟随按钮),
      // 右缘/上下防溢出以聊天滚动容器 rect 为界
      React.useEffect(() => {
        if (tipTurn === null) return undefined
        const compute = () => {
          const el = tipElRef.current
          if (!el || typeof el.getBoundingClientRect !== 'function') return
          const rect = el.getBoundingClientRect()
          let x = rect.right + 10
          let y = rect.top + rect.height / 2
          if (scrollEl && typeof scrollEl.getBoundingClientRect === 'function') {
            const c = scrollEl.getBoundingClientRect()
            const maxX = c.right - 280 - 8 // 卡宽 280px(border-box) + 右缘间距
            if (x > maxX) x = maxX
            if (x < c.left + 4) x = c.left + 4
            if (y < c.top + 8) y = c.top + 8
            if (y > c.bottom - 8) y = c.bottom - 8
          }
          setTipPos((prev) => prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5
            ? prev
            : { x: x, y: y })
        }
        compute()
        if (timer && typeof timer.interval === 'function') {
          return timer.interval(compute, 200)
        }
        return undefined
      }, [tipTurn, scrollEl])

      if (!left) return null

      const items = turns.map((t) => {
        const isCurrent = currentTurn === t.turn
        const clickable = anchors.has(t.turn) || turnUserKeys.has(t.turn)
        const cls = ['sml-rail-item']
        if (isCurrent) cls.push('sml-rail-item-current')
        if (t.status === 'open') cls.push('sml-rail-item-open')
        const label = '第 ' + t.turn + ' 轮' + (t.startTime ? ' · ' + fmtTime(t.startTime) : '') +
          (t.status === 'open' ? ' · 进行中' : '') +
          (clickable ? '' : ' · 暂不可定位')
        // 自定义提示卡替代原生 title(原生无法限制尺寸/加圆角);
        // 鼠标悬停与键盘聚焦(disabled 按钮不派发鼠标事件, 与现状一致)
        const showTip = (e) => {
          tipElRef.current = e.currentTarget
          setTipTurn(t.turn)
          setTipPos(null)
        }
        const hideTip = () => {
          tipElRef.current = null
          setTipTurn(null)
          setTipPos(null)
        }
        return React.createElement('button', {
          key: t.turn,
          type: 'button',
          className: cls.join(' '),
          'data-sml-turn': String(t.turn),
          'aria-label': label,
          disabled: !clickable,
          onMouseEnter: showTip,
          onMouseLeave: hideTip,
          onFocus: showTip,
          onBlur: hideTip,
          onClick: () => jumpTo(t.turn, anchors, scrollEl, turnUserKeys),
        }, String(t.turn))
      })

      const compactTitle = compaction
        ? '已压缩历史对话' +
          (compaction.items !== null ? '：' + compaction.items + ' 条历史记录' : '') +
          (compaction.tokens !== null ? '，约 ' + fmtTokens(compaction.tokens) + ' tokens' : '')
        : ''

      // 提示卡内容: 标题行(轮次/时间/状态) + 该轮第一条用户消息文本
      const tipInfo = tipTurn !== null ? turns.find((t) => t.turn === tipTurn) : null
      const tipLabel = tipInfo
        ? '第 ' + tipInfo.turn + ' 轮' +
          (tipInfo.startTime ? ' · ' + fmtTime(tipInfo.startTime) : '') +
          (tipInfo.status === 'open' ? ' · 进行中' : '')
        : ''
      const tipText = tipTurn !== null && turnTexts ? turnTexts.get(tipTurn) || '' : ''

      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          ref: railRef,
          className: 'sml-rail',
          style: { left: left + 2, top: 96, bottom: 130 },
        },
          React.createElement('div', { className: 'sml-rail-hint' },
            React.createElement(IconChat, { size: 8.8 })),
          compaction ? React.createElement('div', {
            className: 'sml-rail-compact',
            title: compactTitle,
            'aria-label': compactTitle,
          }, React.createElement(IconCompress, { size: 8.8 })) : null,
          turns.length ? items : React.createElement('div', { className: 'sml-rail-empty' }, '暂无'),
        ),
        // 提示卡必须与 .sml-rail 同级: rail 有 overflow-y: auto, 子元素会被裁剪
        tipTurn !== null && tipPos
          ? React.createElement('div', {
            className: 'sml-tip',
            style: { left: tipPos.x, top: tipPos.y },
          },
            React.createElement('div', { className: 'sml-tip-head' }, tipLabel),
            tipText ? React.createElement('div', { className: 'sml-tip-text' }, tipText) : null,
          )
          : null,
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
