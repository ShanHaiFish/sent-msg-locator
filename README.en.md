# Sent Message Locator (sent-msg-locator)

A DSH plugin that **locates every message you sent from the composer** in the current session.

Click the **消息定位 (Locate Messages)** button in the session header to open a 360px
floating panel on the right that lists all user-sent messages (`#N` ordinal / time /
snippet, newest first). It supports keyword **search**, click-to-**expand** the full text,
and **refill the composer** with a message's content (appended to the current draft,
never overwriting it) for reuse or re-editing.

Data comes live from the conversation snapshot (`ConversationSnapshot.nodes` where
`kind === 'user'`), so the list refreshes instantly as you send new messages. Pure
Client plugin: no Host capabilities (no RPC / fs / network / spawn), no DOM manipulation.

## Forms

| Path | Form | Notes |
| --- | --- | --- |
| `package.json` + `cordis.patch.yml` + `lib/index.js` + `client/client.js` | **Static bundle (recommended)** | Installed via `dsh plugin add`; auto-loads from the profile layer stack and survives DSH restarts |
| `manifest.json` + `client-source.js` | Dynamic fallback | For profiles without bundle support; re-register via `cordis_define`/`cordis_run` after every DSH restart |

## Install

```sh
# Local path must not contain spaces — this repo lives under a spaced path, so it is
# installed via a copy at ~/.dsh/plugins-dev/sent-msg-locator (already done on this machine).
dsh plugin --profile web add file:C:/Users/whaow/.dsh/plugins-dev/sent-msg-locator
```

The bundle is registered into `dsh.profile.bundles` of the web profile and loads
automatically on DSH restart (no re-registration needed afterwards). To update,
re-sync the `plugins-dev` copy and re-run the add command.

For the dynamic fallback, follow the restore steps in `README.md` (Chinese) or the
`manifest.json` notes.

## Features

- Persistent floating icon rail on the left edge of the conversation area: one
  numbered bubble per turn (user send → complete assistant reply).
- Click an icon to smooth-scroll to the start of that turn (exact scroll to the
  turn's first user message when resolvable).
- Current-turn highlight follows scrolling; the rail auto-scrolls to keep the
  highlighted icon visible.
- Live updates as the conversation grows; compaction checkpoints show a divider
  marker with "N items · ~M tokens" tooltip; compacted turns disappear.
- Theme-aware via `--dsw-alias-*` CSS variables (light & dark safe).

## Version history

| Version | Notes |
| --- | --- |
| v2.2.0 | Distribution switch: now a static bundle installed into the web profile (via `~/.dsh/plugins-dev/sent-msg-locator`); auto-loads across DSH restarts. Dynamic form kept as fallback. Same features as v2.1.12, security review ALLOW (0/300). |
| v2.1.x | Icon bubbles resized to 80%; contrast-aware current-turn label; compaction divider marker; rail positioning/timing refinements. |
| v2.0.0 | Redesigned as left-edge icon rail with click-to-locate and current-turn highlight; data from official `chat.timeline`; removed panel / search / refill. |
| v1.0.0 | Initial: header entry + floating panel, search / expand / refill. Pure Client, security review ALLOW (0/300). |
