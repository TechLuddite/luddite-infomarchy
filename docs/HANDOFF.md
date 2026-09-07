# Next session

Start here. Details and dead ends: `~/Work/luddite-infomarchy/`.

## What is running

- Git checkout: `~/Projects/luddite-infomarchy` on `feat/phone-view` (also merged to fork `master`).
- Live plugin: `~/.config/omarchy/plugins/techluddite.luddite-infomarchy`. Copy files into it after landings. `omarchy restart shell` reloads QML and `bun web-server.ts`.
- Fork default branch is `master`. Always `--repo TechLuddite/luddite-infomarchy` with `gh`. Do not target `nixfred/infomarchy`.

## Do not

- Print `http://<lan-ip>:8787/t/<token>/` in chat or commits.
- Write into `~/.local/state/omarchy/agents/usage`.
- Bounce PHONE unless you intend to rotate the token.
- Treat `100.64.0.0/10` as this host's VPN. That CIDR is still a default allow. The VLAN CIDR was never given.

## Phone view

- `web-server.ts`. Token in `web.json` (0600). GET/HEAD only. Host/Origin. CSP nonce plus `connect-src 'self'` for the 5s HTML swap.
- PRIVACY on by default. CSS hides WAN/LAN/SSID/`user@host`/home mounts. Those values are still in the HTML (`.open` spans). `snapshot.json` is masked. GitHub login is stripped.
- No 7-day token/$ charts. MACHINE matches the desk meters.
- Overlay COPY PHONE URL does not require keyboard focus. Both InfoSettings instances poll `bun web-server.ts url`.
- UFW: `sudo ufw allow from 172.20.20.0/24 to any port 8787 proto tcp`. Last-octet phone `.192` was the intended client.

## USAGE

- Grok: live `GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the CLI login, 15 min cache `grok-billing.json`, then `~/.grok/logs/unified.jsonl`, then `grok-limits.json`. Token is an Authorization header, `redirect: "error"`.
- Claude: Omarchy's `omarchy-agent-usage-claude` treats a lapsed access token as Sign-in expired even when `claude auth status` is logged in. Wallpaper collector refreshes via `claude -p ping --max-turns 0` then `--limits-only`. Overlay collector does not. 15 min backoff in `prev-*.json` as `claudeAuthRefreshAt`.
- SUPER+I hides the wallpaper desk and, while SUPER+D is open, the overlay desk. Exclusive focus on the overlay layer handles SUPER+I in `Overlay.qml` because the Hyprland bind was swallowed.

## Open follow-ups

Listed at the bottom of `TODO.md`. Highest: mask phone HTML (PRIVACY CSS is not a strip), Tailscale CIDR, live-plugin drift.
