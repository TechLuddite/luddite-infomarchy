# Infomarchy (this fork)

Plugin id `techluddite.luddite-infomarchy`. Default branch on the fork is `master`, not `main`. Upstream is `nixfred/infomarchy`.

Read `README.md` and `docs/HANDOFF.md` before changing Web Mode, USAGE, LOCAL AI, privacy, CONTAINERS, or MEDIA CONTROLS.

Never print a web token URL, `web.json`, or `~/.grok/auth.json` / `~/.claude/.credentials.json` contents in chat, commits, or logs.

The live desk is a separate clone: `~/.config/omarchy/plugins/techluddite.luddite-infomarchy`. Edits here do not run until copied there (then `omarchy restart shell`). Turning WEB off keeps tokens. Revoke a token to rotate it.

Do not write into `omarchy/agents/usage`. Grok billing cache is `$XDG_STATE_HOME/infomarchy/grok-billing.json`, 60s TTL, wallpaper and overlay both fetch. If `updates.jsonl` has no token snaps, Grok USAGE falls back to session-directory counts with no invented bars. `hasTokenData` hides `0 tok` when the provider published none. Per-model rows come from `usageModelBreakdown`. Claude OAuth refresh is `claude -p ping --max-turns 0` when the saved access token has lapsed (`INFOMARCHY_SKIP_CLAUDE_USAGE=1` skips it). Overlay does not ping Claude unless HARD REFRESH. Do not treat Omarchy's leftover `Run claude auth login…` help line as expired: `normalizeUsage` keeps `authHelpText` only when `usageStatusText` is set. HARD REFRESH is the first module-strip chip and runs collector `--force-refresh`.

Hermes recent tasks read `$HERMES_HOME/state.db` or `~/.hermes/state.db`. Live card click accepts a descendant window whose class matches the provider. Session id from `runtime/active_sessions.json` (backend pid). Pi stays.

LOCAL AI talks to `dashboard.json` `ollamaHost`, else `OLLAMA_HOST`, else `http://127.0.0.1:11434`. Topic refinement stays loopback-only unless `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1`.

Stream privacy (SUPER+SHIFT+I) one press on, three presses within 2s off (chip shows 1/3 then 2/3). Overlay ignores auto-repeat. `omarchy-shell infomarchy setPrivacy false` is the one-shot off. Also keeps the first four words of RECENT TASKS · WHAT GOT ASKED and masks the rest. COPY EXCERPT still copies the full text.

CONTAINERS is the second-last right-column card by default. Docker (`/usr/bin/docker`), else Podman. Start/stop goes through `container-control.ts`: live `ps -a` inventory, then the name as its own argv element. Snapshot rows are id, name, label, service, project, image, state, running, health. Compose working_dir, env files, commands, mounts, and ports are dropped. `INFOMARCHY_SKIP_CONTAINERS=1` skips collection.

MEDIA CONTROLS is the last right-column card. Live MPRIS in QML, not the collector. No album-art URL. Stream privacy leaves title and artist in the clear. Not on Web Mode.

Web Mode is the LAN page (WEB on the strip, SETTINGS / bar widget). Tokens in `web.json` (0600). GET/HEAD for the page. POST `/prefs` (Origin required, JSON only) writes `webSections` and `webNarrowOrder`. CSP `connect-src 'self'` and `img-src 'self'`. Colors come from the live Omarchy `colors.toml` (named `green`/`yellow`/`red` plus `colorN`, same pick as the desk). The 5s HTML swap replaces the stylesheet too. Wallpaper is `bg?v=<mtime>-<size>`, an `img.wall` at 0.32 over opaque `--bg`, cards at 0.62, same stack as Overlay.qml. No `backdrop-filter`. Do not put the wallpaper on a CSS `background-image` of the same layer that dims it. RECENT TASKS columns are age, provider, folder (last path segment), prompt: one parent grid, row subgrid, prompt ellipsizes only. PRIVACY is a CSS toggle: WAN/LAN/SSID/`user@host`/home mounts, and RECENT TASKS after the first four words (`obfuscatePrompt`). Session topics stay. Full values remain in `.open` spans. USAGE shows the TOKENS · 7 days graph only, no $ VALUE chart. Per-model rows are meters, same as the desk. `hasTokenData` hides `0 tok`. MEDIA never renders. Turning WEB off keeps tokens. Revoke a token to rotate it.
