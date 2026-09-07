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
- Bounce PHONE unless you intend to rotate the token.
- Treat `100.64.0.0/10` as this host's VPN. That CIDR is still a default allow. The VLAN CIDR was never given.
- Treat Omarchy's leftover `Run claude auth login…` help as Sign-in expired. `claude auth status` and a collector pass can refresh Anthropic limits and make the bars jump.

## Phone view

- `web-server.ts`. Token in `web.json` (0600). GET/HEAD only. Host/Origin. CSP nonce plus `connect-src 'self'` for the 5s HTML swap.
- PRIVACY on by default. CSS hides WAN/LAN/SSID/`user@host`/home mounts. Those values are still in the HTML (`.open` spans). `snapshot.json` is masked. GitHub login is stripped.
- No 7-day token/$ charts. MACHINE matches the desk meters.
- Overlay COPY PHONE URL does not require keyboard focus. Both InfoSettings instances poll `bun web-server.ts url`.
- UFW: `sudo ufw allow from 172.20.20.0/24 to any port 8787 proto tcp`. Last-octet phone `.192` was the intended client.

## Stream privacy (desktop)

- SUPER+SHIFT+I. One press on, three presses within 2s off (chip 1/3, 2/3). Overlay ignores auto-repeat. WAN, LAN, SSID, `user@host`, GitHub login, home mounts, window previews. `omarchy-shell infomarchy setPrivacy false` is the one-shot off. Phone PRIVACY is a separate CSS toggle and stays one click.
- RECENT TASKS · WHAT GOT ASKED keeps the first four words and masks the rest (`obfuscatePrompt` / `displayPrompt`). Inspect drawer matches. COPY EXCERPT still copies the full text. OSS project names and session topics stay.

## CONTAINERS

- Right-column card, last by default (`rightOrder` ends with `containers`). Per-row toggle starts/stops via `container-control.ts`. Inventory from `/usr/bin/docker ps -a`, else podman. Names as argv after a live inventory match.
- Snapshot fields: id, name, label, service, project, image, state, running, health. Compose working_dir, env files, commands, mounts, and ports are dropped. Tests assert `/home/` and `.env` do not survive parse.
- `INFOMARCHY_SKIP_CONTAINERS=1` skips collection. Demo data uses `lab-*` names, not this host's stack.
- Not on the phone HTML. The phone `web-snapshot.json` still carries the object if PHONE is on.

## LOCAL AI

- Origin is `dashboard.json` `ollamaHost`, else `OLLAMA_HOST`, else `http://127.0.0.1:11434`. IPC: `omarchy-shell infomarchy setOllamaHost` / `getOllamaHost`.
- This machine: `http://127.0.0.1:11435`, the Pi SSH tunnel (`pi-ollama-desktop.service` → `desktop:11434`). Models are not local. `hl.env("OLLAMA_HOST", …)` in `~/.config/hypr/hyprland.lua` does not apply until the next login.
- Topic refinement treats loopback as local, including that tunnel. `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1` for a non-loopback host.

## USAGE

- Grok: live `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the CLI login, 60s cache `grok-billing.json`, then `~/.grok/logs/unified.jsonl`, then `grok-limits.json`. Token is an Authorization header, `redirect: "error"`. Overlay also refreshes. `attemptedAt` is the lock. A lapsed CLI token is still tried once. HARD REFRESH (`--force-refresh`) bypasses the TTL.
- HARD REFRESH is the first module-strip chip. Wallpaper IPC: `omarchy-shell infomarchy hardRefresh`. Overlay: `omarchy-shell shell call techluddite.luddite-infomarchy hardRefresh`. Bypasses Grok billing, GitHub, external IP, grok/opencode identity caches; overlay may write GitHub; Claude `--limits-only` is re-read in memory (no write to `omarchy/agents/usage`).
- Claude: Omarchy's `omarchy-agent-usage-claude` treats a lapsed access token as Sign-in expired even when `claude auth status` is logged in. Wallpaper collector refreshes via `claude -p ping --max-turns 0` then `--limits-only` only when `.credentials.json` `expiresAt` has lapsed. Overlay collector does not, except HARD REFRESH which re-reads `--limits-only` in memory. 15 min backoff in `prev-*.json` as `claudeAuthRefreshAt`. Omarchy seeds `authHelpText` with `Run claude auth login…` even on a successful probe. `normalizeUsage` drops `authHelpText` unless `usageStatusText` is set.
- SUPER+I hides the wallpaper desk and, while SUPER+D is open, the overlay desk. Exclusive focus on the overlay layer handles SUPER+I in `Overlay.qml` because the Hyprland bind was swallowed.

## Open follow-ups

Listed at the bottom of `TODO.md`. Highest: mask phone HTML (PRIVACY CSS is not a strip), Tailscale CIDR, live-plugin drift.
