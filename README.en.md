# Sent Message Locator (sent-msg-locator)

[English](README.en.md) · [中文](README.md)

![GitHub Release](https://img.shields.io/github/v/release/ShanHaiFish/sent-msg-locator)
![License](https://img.shields.io/github/license/ShanHaiFish/sent-msg-locator)
![GitHub Stars](https://img.shields.io/github/stars/ShanHaiFish/sent-msg-locator)

A DSH (DeepSeek Harness) plugin that **locates every turn of the current session** (a turn = your message sent → assistant's complete reply).

A slim floating rail sits at the **left edge of the conversation area**: one **bubble-shaped numbered badge** per turn. Click a badge to smooth-scroll the chat viewport to **the first user-typed message of that turn**; the rail highlights the turn you are currently viewing and follows along as you scroll, updating in real time.

**Since v2.2.0 this is a static bundle plugin loaded automatically from the profile layer stack** — install once, and it activates on every DSH startup with no manual `define`/`run` needed.

## Features

- **Left-edge icon rail** (fixed position, ~40px wide, always visible):
  - One bubble-shaped numbered badge per turn (`#N`), latest turns at the bottom
  - Click a badge → smooth-scroll to **the exact user-typed message of that turn** (matched via the built-in chat anchor mechanism `data-chat-anchor-key`, element-level API, never touches `document`/`window`)
  - Current-turn highlight follows scrolling; the rail auto-scrolls to keep the highlighted badge visible
  - In-progress turns show a dashed translucent badge until the reply completes
  - Hover tooltip: "Turn N · time (· in progress / not locatable yet)"
  - Internal scrollbar for long conversations; rail stays at the left edge of the conversation area (right of the sidebar) and follows sidebar collapse/drag via timer-calibrated coordinates
- **Turn unit**: one official engine Turn (user send → assistant complete reply), including open/in-progress status
- **Real-time updates**: the rail refreshes as the session snapshot changes; switching sessions clears stale data automatically
- **Theme aware**: all colors use theme CSS variables (`--dsw-alias-*`), readable on light/dark/any theme

Data comes from the official `chat.timeline` (`turnOrder` + `turns`) merged with the `chat.nodes` snapshot (so turns never disappear when session history is paged via `loadOlder`). No backend dependency, no `document`/`window` manipulation.

> Pure Client plugin: no Host capabilities (no RPC / fs / network / spawn). Scrolling uses only element-level APIs (`closest` / `getBoundingClientRect` / `scrollTo` / `scrollIntoView`).

## Demo

![sent-msg-locator demo animation](assets/demo.gif)

*Click a badge to smooth-scroll to that turn's user-typed message; the current-turn highlight follows scrolling and updates in real time.*

## Quick Start

```sh
# Install (static bundle, recommended)
dsh plugin --profile web add sent-msg-locator
```

For a local, unpublished copy use `file:` pointing at this repository (the path must NOT contain spaces):

```sh
dsh plugin --profile web add file:/path/to/sent-msg-locator
```

Restart `dsh web` and the plugin activates automatically: the numbered rail appears at the left edge of the conversation area. No manual `define`/`run` required.

## Usage

1. **See the rail**: open any session with history — a floating numbered rail appears at the left edge of the conversation area, one bubble badge per completed turn;
2. **Jump to a turn**: click any badge — the chat viewport smooth-scrolls to **the first user-typed message of that turn**;
3. **Follow your position**: scroll the conversation — the current-turn badge highlights (brand color) and the rail auto-scrolls to keep it visible;
4. **Long conversations**: scroll the rail's own scrollbar to browse all turns; older turns appear as you load more history (`Load earlier` in the chat view — the DSH engine pages history at 50 events per request, so earlier turns show up incrementally);
5. **In-progress turns**: while the assistant is replying, the newest badge is dashed/translucent and becomes clickable once the reply completes.

## Repository Contents

| Path | Description |
| --- | --- |
| `package.json` + `cordis.patch.yml` + `lib/` + `client/` | **Static bundle** (recommended): auto-loaded on DSH startup after `dsh plugin add` |
| `manifest.json` + `client-source.js` | Dynamic-plugin fallback form: for profiles without bundle support |
| `assets/demo.gif` | Demo animation shown on the README intro page (~11MB, compressed from the 94MB raw recording) |
| `LICENSE` | MIT License |
| `AGENTS.md` | Agent collaboration conventions (rebuild flow / change workflow / coding conventions / versioning) |
| `README.md` / `README.en.md` | 中文 / English docs |

## Two Forms

| | Static bundle (v2.2.0, recommended) | Dynamic plugin (fallback) |
| --- | --- | --- |
| Loading | `dsh plugin add` installs into the profile layer stack; auto-loaded on DSH startup | Must be re-registered with `cordis_define` + `cordis_run` after every DSH restart |
| Code | `lib/index.js` (Host) + `client/client.js` (Client) | `client-source.js` (Client only; `code.host` is `null`) |
| When to use | Normal profiles (web, etc.) | Profiles without bundle support |

> Do not activate the static bundle and the dynamic form at the same time — the same slots would be registered twice and the rail would render duplicated.

Dynamic fallback steps:

1. Have an agent read `client-source.js`;
2. `cordis_define`: `plugin: { kind: "new", idPrefix: "smsg" }`, `name`/`purpose` from `manifest.json`, `code.host: null`, `code.client` as the full content of `client-source.js`;
3. `cordis_run` to activate; success when the rail appears.

> The dynamic form does not survive DSH restarts and must be reloaded; the static bundle form has no such limitation.

## Technical Notes

- **Data source**: `useSession` snapshot → official `chat.timeline` (`turnOrder` + `turns`) as primary, `chat.nodes` snapshot as fallback — merged so turns never go missing when session history is paged (`loadOlder` limits each page to 50 events). Per-turn fields: `turn` number / `start.time` / `end.time` / `status` (`open` / `closed` / `unknown`).
- **Data bridge**: a hidden 0-size element inside the session-scoped `conversation.input.dock` slot captures `useSession`/`sessionId` and measures the conversation-area left edge (`getBoundingClientRect`, element-level) as the fixed-position baseline; a 300ms timer poll keeps the rail attached to the sidebar's right edge when the sidebar collapses or is dragged.
- **Turn-tail anchors**: the additive `conversation.chat.assistant-actions` slot renders a 0-size anchor element at each completed assistant message, resolving its turn from the snapshot node's `data.turn`; the first anchor attaches a `scroll` listener on the chat scroll container (`closest('[data-conversation-scroll]')`) for current-turn detection.
- **Precise jump**: click → match the snapshot node key against the built-in `data-chat-anchor-key` rows (element-level `querySelectorAll`), compute the row position, smooth-scroll; falls back to the tail-anchor position when the row is missing.
- **Current-turn detection**: on scroll, the turn of the first anchor below the viewport top wins; the rail keeps the highlighted badge visible with `scrollIntoView({ block: 'nearest' })`.
- **Compaction marker (v2.1.12)**: after DSH auto-compaction the old turns disappear from the rail; a small compaction icon + dashed separator appears at the top (detected via `kind === 'compaction'` checkpoint nodes), tooltip "N history records compressed · ~M tokens".
- All slots are additive (`conversation.input.dock` / `conversation.chat.assistant-actions` / `shell.overlay`); no built-in UI is replaced.

## Security & Boundaries

- **Capability declaration**: none (pure UI) — no network requests, no spawn/process, no filesystem, no `document`/`window` globals; client uses only `ctx / React / styles / console` built-ins.
- **Security review**: ALLOW (0/300), reviewed by `plugin_security_review` (see [dsh-plugin-security-review](https://github.com/ShanHaiFish/dsh-plugin-security-review)).
- **Known limitation**: the DSH engine pages session history (50 events per `Load earlier` request), so the rail can only show turns within the currently loaded window; earlier turns appear incrementally as history is loaded. This is engine behavior, not a plugin defect.

## Version History

| Version | Notes |
| --- | --- |
| v2.2.0 | Switched to static bundle form: installed into the web profile via the `~/.dsh/plugins-dev/sent-msg-locator` copy (`file:` install, added to the `dsh.profile.bundles` layer stack), auto-loads across DSH restarts; dynamic form (`manifest.json` + `client-source.js`) kept as fallback; functionality identical to v2.1.12; security review ALLOW (0/300) |
| v2.1.12 | Added compaction visual separator: after DSH auto-compaction old turns disappear from the rail and a compaction icon + dashed divider appears at the top (detected via `kind === 'compaction'` checkpoint nodes), tooltip "N history records compressed · ~M tokens" |
| v2.1.11 | Shrunk badges to 80% (22→17.6px, font 10.5→8.4px); current-turn digit now uses `contrast-color()` for black/white by brand luminance (falls back to `#fff`), fixing invisible white digits on light brand themes |
| v2.1.10 | Nudged the rail 5px→2px from the conversation-area left edge |
| v2.1.9 | Nudged the rail 7px→5px from the conversation-area left edge |
| v2.1.8 | Nudged the rail 14px→7px from the conversation-area left edge |
| v2.1.7 | Made the rail body fully transparent (removed background/border/shadow/radius), keeping only the bubble badges — no more occlusion when the rail overlaps conversation text at narrow widths |
| v2.1.6 | Rebased the left-edge measurement to the chat scroll container `[data-conversation-scroll]` — the hero phase (blank session) uses a narrow centered composer (~812px), so measuring the dock row's left edge pushed the rail away from the sidebar and over the input box; the scroll container spans the whole conversation column and its left edge equals the conversation-area left edge in hero/active/settling phases |
| v2.1.5 | Restored a visible rail scrollbar and widened the rail (28→40px) so all turns are browsable when there are many |
| v2.1.4 | Fixed missing turns: the official timeline can omit early turns when history is paged; turns are now derived from timeline + chat nodes merged, so every rendered turn shows up |
| v2.1.3 | Left a gap between the rail and the sidebar right edge (left +14) |
| v2.1.2 | Moved the rail down below the session header so it no longer covers the "Chat" view tab |
| v2.1.1 | Anchored the rail to the sidebar right edge (conversation-area left edge); timer-polled coordinate calibration follows sidebar collapse/drag |
| v2.1.0 | Click now jumps precisely to the first user-typed message of the turn (snapshot node key matched against the built-in `data-chat-anchor-key` rows); current-turn detection switched to "first anchor below viewport top" for accurate highlight |
| v2.0.0 | Rebuilt as the left-edge icon rail: one bubble numbered badge per turn, click to smooth-scroll to the turn start, current-turn highlight + auto-follow; removed the header entry, right panel, search, expand, refill; one turn = official engine Turn; data from `chat.timeline`; pure Client, security review ALLOW (0/300) |
| v1.0.0 | Initial release: header "Locate Messages" button + right floating panel, search / expand full text / refill composer; pure Client, security review ALLOW (0/300) |
