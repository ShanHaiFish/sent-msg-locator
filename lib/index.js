// ============================================================
// 已发送消息定位 (sent-msg-locator) — v1.0.0 (DSH 静态 bundle 插件 · Host 半区)
// 随 profile 层栈自动加载(像 fexp-file-explorer / dsh-plugin-security-review
// 一样), 无需每次重启 DSH 后重新 cordis_define/run。
//
// 本插件是纯 Client 插件: 全部 UI(标题栏入口 + 右侧浮动面板)由
// client/client.js 提供, Host 半区不需要任何能力(RPC/fs/网络均无)。
// 此 apply 保持最小空实现, 仅让 bundle 在 profile 层栈中合法挂载。
// ============================================================
export const name = 'smsg'

export function apply(ctx) {
  // 纯 Client 插件: 无 Host 业务能力。
  // 若后续需要 Host RPC, 在此用 webServer.register 挂 /smsg/* JSON 路由,
  // 并在 client/client.js 中以 fetch 调用(见 fexp-file-explorer 的做法)。
  void ctx
}
