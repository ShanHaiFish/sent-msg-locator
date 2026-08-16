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
dsh plugin --profile web add file:/path/to/sent-msg-locator   # static bundle
dsh plugin --profile web update sent-msg-locator              # upgrade
```

For the dynamic fallback, follow the restore steps in `README.md` (Chinese) or the
`manifest.json` notes.

## Features

- Session-header entry button with a live count badge.
- Full sent-message list: ordinal `#N`, time (HH:mm same day, dated otherwise), snippet.
- Keyword / ordinal search with empty states.
- Expand / collapse full text (images flagged as 含图片).
- Refill composer with a message's content (append semantics).
- Theme-aware via `--dsw-alias-*` CSS variables (light & dark safe).

## Version history

| Version | Notes |
| --- | --- |
| v1.0.0 | Initial: header entry + floating panel, search / expand / refill. Pure Client, security review ALLOW (0/300). |
