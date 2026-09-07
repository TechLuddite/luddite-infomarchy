# Changelog

All notable changes to Infomarchy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Security
- USAGE shows local Grok and OpenCode token totals from session files (`updates.jsonl`, `opencode.db`) when Omarchy has no collector for them. Rows are labelled `local` with no 5-hour/weekly meters. Omarchy cache records are never overwritten, and nothing is written into `omarchy/agents/usage`.
- Observational git in an agent working tree pins `core.fsmonitor=false`, `core.hooksPath=/dev/null`, empty `diff.external` and `credential.helper`, and ignores global/system git config. `git diff` also passes `--no-ext-diff --no-textconv`.
- GitHub Actions polling uses `gh run list --repo owner/name` after parsing `origin` as github.com. Non-github remotes are skipped. The agent's cwd is not the `gh` process cwd.
- Grok Bot redacts credentials before flattening markdown, so underscore stripping cannot split `ghp_` / `ntn_` prefixes.
- `INFOMARCHY_SKIP_GITHUB=1` now also skips `gh run list` CI polling.
- Herdr window matching requires the agent's socket. No first-client fallback.
- `safePrompt` also covers `github_pat_`, `xai-`, `glpat-`, `hf_`, Stripe `sk_live_`/`sk_test_`, and `npm_`.
- Resume uses the same project-directory guard as Open Project.
- Default-route interface names are shape-checked before sysfs reads. `0.0.0.0` is no longer treated as loopback Ollama.

### Added
- **CONTAINERS.** A removable, reorderable card at the bottom of the right column lists Docker (else Podman) containers with a per-row on/off toggle. Start/stop is inventory-checked (`docker ps -a` / `podman ps -a`) and the name is an argv element, never a shell string. Compose labels show the service name. Eight rows max. Compose working_dir, env files, commands, mounts, and ports are dropped from the snapshot. `INFOMARCHY_SKIP_CONTAINERS=1` skips collection.
- **Stream privacy (SUPER+SHIFT+I).** Toggles a persistent mask on the wallpaper and overlay: WAN, LAN, Wi-Fi SSID, `user@host`, GitHub `@login`, `/home/<user>` disk mounts, and hover window previews. Recent-task prompts keep the first four words and mask the rest. OSS project names, repos, and session topics stay. `omarchy-shell infomarchy togglePrivacy` (also `setPrivacy` / `getPrivacy`). The module strip shows **PRIVACY ON** while it is active.
- **Pi sessions.** Live cards, recent prompts, heatmap kind, LOCAL AI chip, and RESUME (`pi --session <id>`) read `~/.pi/agent/sessions`. The default 80-row recent window keeps each provider's newest prompts so a busy Claude week cannot hide OpenCode or Pi.
- **Phone view.** PHONE on the module strip starts a LAN-only, read-only web page of the desk. Token in the URL, RFC1918/loopback/Tailscale source allowlist, Host/Origin checks, CSP, HTML-escaped prompts, GET/HEAD only. Identity fields (WAN, LAN, SSID, user@host, GitHub login) are stripped. Extra VPN CIDRs: `omarchy-shell infomarchy setWebCidrs 10.x.x.x/24` then toggle PHONE off and on. Overlay COPY PHONE URL puts the link on the clipboard.
- **Grok weekly meter.** If `$XDG_STATE_HOME/infomarchy/grok-limits.json` has an observed weekly pool percent and reset, USAGE shows it as the same kind of bar as Claude/Codex. No 5-hour Grok window is invented. Local token totals still feed the 7-day trend.
- **GITHUB · LAST 7 DAYS.** The activity row is now two half-width cards: the AI prompt heatmap on the left and, on the right, the same hour-by-hour grid fed from GitHub — commits, PRs, reviews, issues, comments and other events, coloured by dominant kind, hover for the breakdown and the repositories, today/week counts in the header. Click pins a cell; a legend kind recolours the grid to that kind alone. It is a removable module (**4** in the overlay; the modules after it shift one key and **0** reaches the tenth) and either card takes the full row when the other is hidden.
- **Grok Bot gets a card per bot.** The xAI desktop app runs its whole roster inside one Electron process, so `/proc` can only ever show one agent. Infomarchy reads the app's own local roster (`~/.config/Grok Bot/sand-client-persistence`, one plain-JSON file per state slice, named by the base32 of its key) and expands it into one **Live AI session** card per bot: the bot's name, the last line it wrote (markdown flattened, secrets redacted the same way prompts are), and its **Needs You** state — *waiting for your answer*, or *has replies you have not read* with the count on the card. Hidden-from-sidebar bots get no card, and transcripts are never opened. Because the bots share one process, its CPU/RAM/GPU counters are attributed once — to the bot the app currently has open — and the other cards report `—` rather than repeating the same process nine times. The alert key omits the unread count, so a bot notifies when it goes unread, not again on every further reply.
- **Grok Bot is detected at all.** Electron rewrites its process title, so the whole command line arrives as a single `argv[0]` — and the install path itself contains a space. The browser process is now matched on that line, while the zygote/renderer/gpu/utility helpers (`--type=`) and the `local-exec-daemon` script are not.
- **Grok CLI sessions are counted from disk.** Grok ≥ 1.0 gives every session its own directory under the encoded cwd, so sessions that have not been prompted yet were invisible. `GROK_HOME` is honoured, and a project path too long to encode is read back from the group's `.cwd` file instead of showing as a slug plus a hash.
- `github-activity.ts`: commits from `gh api search/commits` by author date (one row per commit, default branches only), everything else from the user's own events feed; both slimmed by `gh --jq` so no commit message or issue body is ever parsed. A private `github-activity.json` store, written by the wallpaper collector and read by the overlay, fills the week incrementally (one step a minute until covered, then every five minutes, at most a handful of calls per step), pages the events feed until a known id, walks one search query page by page so timestamp ties cannot stall it, re-walks the window every six hours for late-indexed commits, backs off on failures, resets on an account change, and survives restarts and dropped connections as a *stale* grid. `INFOMARCHY_SKIP_GITHUB=1` disables it.

### Changed
- LIVE AI SESSIONS cards clip and elide long topic, git, and pid lines, and the STALE chip shrinks instead of painting into the next card.
- LOCAL AI can persist an Ollama origin (`ollamaHost` in `dashboard.json`, `omarchy-shell infomarchy setOllamaHost`). Empty inherits `OLLAMA_HOST`, then `http://127.0.0.1:11434`. Topic refinement still requires loopback unless `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1`.
- Stream privacy masks RECENT TASKS · WHAT GOT ASKED after the first four words on the wallpaper and overlay. The prompt inspect drawer uses the same mask. COPY EXCERPT still copies the full text.
- Phone view no longer does a full-page reload every 5s. A same-origin fetch swaps `#view` and keeps scroll, with a Refresh link if script is off. CSP allows that script only via a per-response nonce plus `connect-src 'self'`.
- Phone MACHINE uses the same meter grid as the desk: CPU (load, temp), RAM, two disks, wifi signal, ↓↑ rates, ping, battery.
- Phone USAGE drops the 7-day token and $ charts. A PRIVACY button (on by default) hides WAN, LAN, SSID, `user@host`, and home mounts. Turn it off to show them.
- Overlay SUPER+I hides the desk while SUPER+D is open. Exclusive keyboard focus was swallowing the Hyprland bind.
- Grok WEEKLY/BUILD meters read live billing (`cli-chat-proxy.grok.com`, same route as Grok `/usage`), cached 15 minutes in `grok-billing.json`. Falls back to `~/.grok/logs/unified.jsonl`, then `grok-limits.json`. The token stays in `auth.json` and only travels as an `Authorization` header.
- Claude USAGE meters: when Omarchy reports Sign-in expired because the saved access token lapsed, the wallpaper collector asks the Claude CLI to refresh it (one `claude -p` with `--max-turns 0`, at most every 15 minutes) and re-reads limits. It does not write into `omarchy/agents/usage`. Omarchy's collector leaves `Run claude auth login…` on a successful probe; Infomarchy now drops that help line unless a real status is set, so the desk does not look expired while the meters are live.
- Plugin id is `techluddite.luddite-infomarchy`. Install, remove, binds, overlay toggle, and notification `--exec` all use that id.
- A live Grok card now resolves its own session id from the session files the CLI holds open, instead of inferring one from the project's prompt history.
- Session cards and the inspector print `—` for a resource counter that is genuinely unavailable, rather than `0B` / `0 proc`.
- The heatmap canvas, tooltip and legend are one `HeatPanel` component used by both cards. Card header hints now elide instead of pushing past a half-width card.

### Fixed
- The module strip sat `Style.spacing.sm` (4px at scale 1) above the cards while every other desk gap is `view.gap` / `Style.spacing.lg` (8px). The outer column now uses `view.gap`. Chip-to-chip spacing inside the strip is unchanged.

## [1.0.0] — 2026-09-05

1.0 marks the desk as complete for daily use: every card reaches its session (terminal, Herdr, tmux, Boomux or a Claude background job), the whole desk fits a 1920×1080 screen with nothing clipped or running off the edge, and the layout is instrumented so future fixes are measured rather than guessed.

### Added
- **Every Claude card reaches its session.** Claude Code's own registry (`claude agents --json`) is merged by pid: exact job ids on Herdr-hosted sessions, session names on cards, busy state from the registry, `blocked` shown as waiting. Background sessions open with `claude attach <id>` in a terminal. The `claude daemon run` supervisor is no longer mistaken for a session (the phantom "Improving Pi" card).
- **Zombie sessions.** A session that is unattended (background, or no window and nothing attachable), not busy and idle for six hours gets a **STALE · idle Nh** tag. The inspector offers **STOP SESSION** (`claude stop <id>`, transcript kept) and **END PROCESS** (SIGTERM, only if the pid's start time and agent argv still match the card). Two clicks, four-second arm window, never automatic.
- **SUPER+I / SUPER+D legend.** Header hints in the overlay; one quiet line under the MACHINE card on the wallpaper.
- `omarchy-shell infomarchy geometry` — the settled layout widths (view, columns, LOCAL AI card/body/rows/tag/meter and each row's implicit width) as JSON. Read it before touching a layout constant.

### Changed
- **The desk fits 1080p end to end.** MACHINE is a two-column grid (CPU|RAM, DISK|WIFI) with a one-line footer (WAN · LAN / rates · ping · BAT); sessions sit on one row; ops cards are content-sized; RECENT TASKS keeps a minimum height; LOCAL AI rows share one action column with fixed arrow and action slots; Meter values elide instead of pushing; both columns are fractions of the view width, never constants.

### Fixed
- **SUPER+D shows the real desktop** (theme background behind the wallpaper) and **SUPER+I applies inside the overlay** as well as on the wallpaper. SUPER+D then SUPER+I now does what it says.
- **LOCAL AI pills lost their right border.** The provider-chips row was a `RowLayout` of rigid tags whose minimum (514 px) exceeded the card body (512 px); the column then laid every row out 2 px past the clip, cutting the right edge of LOAD/UNLOAD and the GPU bar. The chips are now a `Flow` (no minimum; wraps if labels grow). Found by measuring, not guessing: new `omarchy-shell infomarchy geometry` IPC reports the settled layout widths.

## [0.5.0] — 2026-09-05

### Added
- **7-day token trend** in USAGE & LIMITS: one line per provider, tokens per day, hover for exact figures, with a **TOKENS / ≈ $ VALUE** toggle. Per-provider rows show today's and lifetime *estimated API value*, cache-read share and session count. Fed entirely from Omarchy's Agents usage cache — no new scanning. Prices from a pinned, attributed LiteLLM snapshot (`pricing.json`, `THIRD_PARTY_NOTICES.md`); unknown models are shown as unpriced, never guessed.
- **Clicking a card jumps inside the multiplexer.** Herdr: the agent descends from `herdr server`, so the client terminal is found through the Herdr client process and the pane is focused over Herdr's socket API (`workspace.focus → tab.focus → pane.focus`, bundled `herdr-focus.ts`). tmux: `select-window`, `select-pane`, `switch-client`. Boomux: window matched via the `__attach` client or Boomux's own window title, then `boomux open <shell-id> --workspace <name>` (verified on 1.9.7).
- Sessions running under Claude Code's background daemon (`bg-pty-host`) are labelled **background · claude daemon** and dimmed instead of looking like a duplicate of the interactive session in the same repository.

### Fixed
- Attention rows and the inspector's FOCUS use the multiplexer-aware path.

## [0.4.1] — 2026-09-05

Marketplace security-review follow-up (omacom/omarchy-plugin-marketplace#2931).

### Changed
- Subprocess deadlines are firm: SIGTERM, a 250 ms grace period, SIGKILL if still alive, then reaped — in the collector and in every window-preview stage.
- Successful preview artifacts are deleted with an ownership check when a preview is replaced, when previews are disabled, when the session's window is gone, and when the view is destroyed; the stale sweep is capped at 32 removals per run.

## [0.4.0] — 2026-09-05

First marketplace release with the operations desk. Verified on a stock Omarchy 4.0.2 VM (fresh install, no bun → install hint → `pacman -S bun` → desk fills in without a restart), and by two independent Codex reviews (gpt-5.6-sol and gpt-6-astra) whose 60+ confirmed findings were each reproduced before being fixed.

### Added
- **Operations desk**: WHAT CHANGED (per-repository working-tree summary with seen/unseen tracking), NEXT ACTIONS (specific blocked / waiting / review signals with one-click ANSWER / RESOLVE / REVIEW / RESUME), PROJECT HEALTH (branch, dirty state, ahead/behind, last commit, newest GitHub Actions run via authenticated `gh`, click to filter the whole dashboard). All three are draggable and individually removable.
- **Proactive alerts** through Omarchy's notification service: blocked, waiting, ready-for-review, ended, and title-reported crashes; persistent seven-day deduplication with episode tracking; global switch, per-provider mutes, and quiet hours (22:00–08:00). Clicking an alert opens the fullscreen desk.
- **Multiplexer-hosted sessions**: agents inside Herdr, Boomux, or tmux stay visible with their bounded host identity; an attached tmux pane focuses its real client terminal and switches the client to that pane.
- **Ollama controls**: pick any installed model, LOAD (pinned) / UNLOAD per loaded row, size-aware CONFIRM for large models.
- **Hermes** (NousResearch) detected as a provider.
- Session inspector (right-click a card): move to workspace, focus, open a terminal in the project, toggle hover previews.
- Prompt search, pinning, and per-cell heatmap drill-down; recent rows shipped up to 1,000 for a full week.
- `CHANGELOG.md`, and a `bun` install step in the README (Omarchy does not ship bun).

### Changed
- Collector output is one awaited write; snapshots are capped at 960 KiB, below the shell-side limit, so a valid frame can never be rejected.
- Every external JSON source (histories, usage caches, Ollama, hyprctl, gh) is parsed through one bounded, coercion-safe path; malformed or hostile content degrades a single card, never the desk.
- Automatic topic refinement talks only to a loopback Ollama unless `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1` is set — prompt text does not leave the machine by default.
- Demo mode now covers the SUPER+D overlay as well as the wallpaper.
- Credential redaction covers env-style assignments, credentials in URLs, PEM blocks, JWTs, and common cloud key shapes (best effort).
- Provider detection matches the executable only (or a script run by a known interpreter): `cat /tmp/claude` is no longer an agent.
- Attention signals are evaluated only for idle agents; a title that mentions "permission" or "failed" mid-task no longer alerts.
- The collector keeps running at a quarter cadence while the desk is hidden so alerts still arrive; it stops entirely only when alerts are off too.
- Throughput is displayed in bits/s; COPY PROMPT is now COPY EXCERPT (140-character redacted excerpt).

### Fixed
- Desk went blank on: a `%` in a Grok session directory name, a non-array `active_sessions.json`, a nested object in a Grok pid, a null entry from `hyprctl clients`, `{"toString":0}` anywhere in external JSON, two large usage caches, and a `history.jsonl` over 8 MB (Claude then showed as "not installed"). All degrade gracefully now.
- Desk froze when a killed helper left a child holding its pipe (`gh` → `git`, shell → `sleep`); the collector now abandons the pipe at its deadline and exits explicitly.
- Ollama LOAD / UNLOAD never completed (helper waited for stdin EOF that Quickshell never sends).
- Topic refinement cached its own timeouts as summaries and never retried; Codex rows had no project and RESUME opened `$HOME`; pinned prompts vanished past 80 rows; quiet-hours and muted alerts were marked delivered and never shown; the first snapshot after a restart dropped ended-session events.
- Display escaping corrupted paths and clipboard text (`~/R&D` → `~/R＆D`); `/home/pi2` was treated as inside `/home/pi`; Git paths with non-ASCII characters were shown as octal escapes.
- Session inference could bind a live agent to a later session's prompts or steal an id another live agent owned.
- Resource leaks: preview temp directories, orphaned state temp files, unbounded topic/pin/mute/seen maps, per-tick full scans of `opencode.db`, unbounded git/gh/Ollama fan-out, rollout enumeration past the cap.
- Inspector drawer froze on stale data; the wallpaper search box could never receive keystrokes; busy/attention animations ran while hidden; garbage `nvidia-smi` / `df` / `ping` output rendered as an empty GPU, a null disk, or a QML binding error.

## [0.2.1] — 2026-08-28

- Four live session cards per row; clipboard and preview helper hardening.

## [0.2.0] — 2026-08-27

- First marketplace-hardened build: live AI sessions, 7-day heatmap, recent tasks, usage limits, local AI, machine telemetry, SUPER+D overlay, SUPER+I toggle.
