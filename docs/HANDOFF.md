# Next session

Start here. Details and dead ends: `~/Work/luddite-infomarchy/`.

## What is running

- Git checkout: `~/Projects/luddite-infomarchy` on fork `master`.
- Live plugin: `~/.config/omarchy/plugins/techluddite.luddite-infomarchy`. Copy files into it after landings. `omarchy restart shell` reloads QML and `bun web-server.ts`.
- Fork default branch is `master`. Always `--repo TechLuddite/luddite-infomarchy` with `gh`. Do not target `nixfred/infomarchy`.

## Do not

- Print `http://<lan-ip>:8787/t/<token>/` in chat or commits.
- Print `web.json`, `~/.grok/auth.json`, or `~/.claude/.credentials.json`.
- Write into `~/.local/state/omarchy/agents/usage`.
- Revoke a Web Mode token to rotate it. Turning WEB off keeps tokens.
- Treat `100.64.0.0/10` as this host's VPN. That CIDR is still a default allow. The VLAN CIDR was never given.
- Treat Omarchy's leftover `Run claude auth login…` help as Sign-in expired. `claude auth status` and a collector pass can refresh Anthropic limits and make the bars jump.

## Web Mode

- `web-server.ts`. Tokens in `web.json` (0600). GET/HEAD for the page. POST `/prefs` (Origin required, JSON only) writes `webSections` and `webNarrowOrder` into `dashboard.json`. Host/Origin. CSP nonce plus `connect-src 'self'` and `img-src 'self'` for the 5s HTML swap, wallpaper, and prefs fetch.
- HTML matches the SUPER+D desk: two columns, theme colors from `~/.local/state/omarchy/current/theme/colors.toml` (named `green`/`yellow`/`red` plus `colorN`, same pick order as the desk). The 5s HTML swap also replaces the page stylesheet, so a theme change lands without F5. Wallpaper is `bg?v=<mtime>-<size>` so a theme swap does not keep the previous image. The `.wall` layer is an `img` inside `#view` (recreated on each swap) at 0.32 opacity over an opaque theme fill, then cards at 0.62, same stack as Overlay.qml. Wallpaper `cover`/`center`. Do not use CSS `background-image` on the dimming layer. No `backdrop-filter`. RECENT TASKS columns are age, provider, folder (last path segment), prompt: one parent grid, row subgrid, prompt ellipsizes only. Narrow viewports stack, `display:contents` plus `--stack-order`, UP/DOWN on each card. Strip chips toggle section visibility. Zoom is session-local (`im-scale`). USAGE shows TOKENS · 7 days only, no $ VALUE graph. Today line uses `hasTokenData` and session counts. Per-model rows are meters, same as the desk. MEDIA never renders.
- PRIVACY on by default. CSS hides WAN/LAN/SSID/`user@host`/home mounts and recent-task prompts after the first four words (same `obfuscatePrompt` as the desk). Full prompt stays in `.open` spans. Session topics stay. `snapshot.json` is masked. GitHub login is stripped.
- SETTINGS on the strip and the Infomarchy bar widget manage tokens, QR, extra CIDRs, and desk/web section visibility. Turning WEB off keeps tokens. Revoke to rotate.
- Overlay COPY URL lives in SETTINGS. Both InfoSettings instances poll `bun web-server.ts url`.
- UFW: `sudo ufw allow from 172.20.20.0/24 to any port 8787 proto tcp`. Last-octet phone `.192` was the intended client.

## Stream privacy (desktop)

- SUPER+SHIFT+I. One press on, three presses within 2s off (chip 1/3, 2/3). Overlay ignores auto-repeat. WAN, LAN, SSID, `user@host`, GitHub login, home mounts, window previews. `omarchy-shell infomarchy setPrivacy false` is the one-shot off. Web Mode PRIVACY is a separate CSS toggle and stays one click.
- RECENT TASKS · WHAT GOT ASKED keeps the first four words and masks the rest (`obfuscatePrompt` / `displayPrompt`). Inspect drawer matches. COPY EXCERPT still copies the full text. OSS project names and session topics stay.

## CONTAINERS

- Right-column card, second-last by default (`rightOrder` ends with `containers`, then `media`). Per-row toggle starts/stops via `container-control.ts`. Inventory from `/usr/bin/docker ps -a`, else podman. Names as argv after a live inventory match.
- Snapshot fields: id, name, label, service, project, image, state, running, health. Compose working_dir, env files, commands, mounts, and ports are dropped. Tests assert `/home/` and `.env` do not survive parse.
- `INFOMARCHY_SKIP_CONTAINERS=1` skips collection. Demo data uses `lab-*` names, not this host's stack.
- Not on Web Mode. `web-snapshot.json` still carries the object if WEB is on.

## MEDIA CONTROLS

- Last right-column card (`rightOrder` ends with `media`). Live MPRIS in QML, not the collector. Title, artist, album, identity. PREV / PLAY or PAUSE / NEXT. Prefers a playing player. Skips `playerctld` when another player exists. No `trackArtUrl`. Stream privacy leaves those fields in the clear. Not on Web Mode. Demo mode shows a fake track and ignores clicks.

## LOCAL AI

- Origin is `dashboard.json` `ollamaHost`, else `OLLAMA_HOST`, else `http://127.0.0.1:11434`. IPC: `omarchy-shell infomarchy setOllamaHost` / `getOllamaHost`.
- This machine: `http://127.0.0.1:11435`, the Pi SSH tunnel (`pi-ollama-desktop.service` → `desktop:11434`). Models are not local. `hl.env("OLLAMA_HOST", …)` in `~/.config/hypr/hyprland.lua` does not apply until the next login.
- Topic refinement treats loopback as local, including that tunnel. `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1` for a non-loopback host.

## USAGE

- Grok: live `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the CLI login, 60s cache `grok-billing.json`, then `~/.grok/logs/unified.jsonl`, then `grok-limits.json`. Token is an Authorization header, `redirect: "error"`. Overlay also refreshes. `attemptedAt` is the lock. A lapsed CLI token is still tried once. HARD REFRESH (`--force-refresh`) bypasses the TTL. Local tokens still come from `updates.jsonl`. If that yields nothing, session dirs (`summary.json`) fill prompts/sessions/models with no invented bars. `hasTokenData` hides `0 tok`. Per-model meters are in QML and Web Mode.
- Hermes: recent prompts from `$HERMES_HOME/state.db` or `~/.hermes/state.db`. Resume `hermes --resume <id>`. Live click raises the Hermes app (descendant window, class-gated). Session id from `runtime/active_sessions.json`. Pi stays. Herdr click is not gated on `attached`.
- HARD REFRESH is the first module-strip chip. Wallpaper IPC: `omarchy-shell infomarchy hardRefresh`. Overlay: `omarchy-shell shell call techluddite.luddite-infomarchy hardRefresh`. Bypasses Grok billing, GitHub, external IP, grok/opencode identity caches; overlay may write GitHub; Claude `--limits-only` is re-read in memory (no write to `omarchy/agents/usage`).
- Claude: Omarchy's `omarchy-agent-usage-claude` treats a lapsed access token as Sign-in expired even when `claude auth status` is logged in. Wallpaper collector refreshes via `claude -p ping --max-turns 0` then `--limits-only` only when `.credentials.json` `expiresAt` has lapsed. Overlay collector does not, except HARD REFRESH which re-reads `--limits-only` in memory. 15 min backoff in `prev-*.json` as `claudeAuthRefreshAt`. Omarchy seeds `authHelpText` with `Run claude auth login…` even on a successful probe. `normalizeUsage` drops `authHelpText` unless `usageStatusText` is set.
- SUPER+I hides the wallpaper desk and, while SUPER+D is open, the overlay desk. Exclusive focus on the overlay layer handles SUPER+I in `Overlay.qml` because the Hyprland bind was swallowed.

## Open follow-ups

Listed at the bottom of `TODO.md`. Highest: mask Web Mode HTML (PRIVACY CSS is not a strip), Tailscale CIDR, live-plugin drift.
