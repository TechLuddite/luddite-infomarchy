# Infomarchy

A fork of [Infomarchy](https://github.com/nixfred/infomarchy) by [Fred Nix](https://github.com/nixfred), with Larry.

The wallpaper desk, the collector, and the design are theirs. Use [the original](https://github.com/nixfred/infomarchy) unless you want the changes below. How the desk works is documented there.

<p align="center">
  <img src="preview.png" alt="Infomarchy with sanitized demo data on an empty 1080p Omarchy desktop" width="100%">
</p>

## What this fork changes

**Plugin id** is `techluddite.luddite-infomarchy`, so it does not collide with `nixfred.infomarchy`.

**USAGE** reads Grok session files (`updates.jsonl`) and OpenCode assistant token fields when Omarchy has no collector for them. Those rows are labelled `local` and have no 5-hour or weekly meters. If Grok has no `updates.jsonl` snaps, the row falls back to session-directory counts (`summary.json`) with no invented limit bars. A provider with no token data does not show `0 tok`. Each provider can list per-model share from what it already reports. Omarchy cache records are never overwritten, and nothing is written into `omarchy/agents/usage`. Each provider sits in its own tinted bordered block. When Omarchy reports Claude Sign-in expired because the saved access token lapsed, the wallpaper collector runs one `claude -p ping --max-turns 0` (at most every 15 minutes) so the CLI can refresh OAuth, then re-reads limits. Skip with `INFOMARCHY_SKIP_CLAUDE_USAGE=1`. A leftover `Run claude auth login` help line on a successful limits probe is dropped, so USAGE does not look expired while the meters are live.

**Git and GitHub CI.** Observational git in an agent working tree pins `core.fsmonitor=false`, `core.hooksPath=/dev/null`, empty `diff.external` and `credential.helper`, and ignores global/system git config. `git diff` also passes `--no-ext-diff --no-textconv`. `gh run list` uses `--repo owner/name` after parsing `origin` as github.com. Non-github remotes are skipped. The agent's cwd is not the `gh` process cwd.

**Stream privacy.** SUPER+SHIFT+I (or `omarchy-shell infomarchy togglePrivacy`) hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. One press turns it on. Three presses within two seconds turn it off (the chip shows 1/3, then 2/3). Overlay ignores key-repeat. `omarchy-shell infomarchy setPrivacy false` still clears it in one shot. Recent-task prompts keep the first four words and mask the rest, including the inspect drawer. COPY EXCERPT still copies the full text. OSS project names stay. Web Mode PRIVACY is a separate CSS toggle and stays one click.

**Pi.** Live sessions and recent prompts come from the Pi agent (`~/.pi/agent/sessions`). The default recent-task window keeps each provider's newest prompts, including OpenCode.

**Hermes.** Recent prompts come from `$HERMES_HOME/state.db` or `~/.hermes/state.db`. Resume is `hermes --resume <id>`. A live Hermes card raises the Hermes app (window below the launcher, class-gated) and reads the session id from the lease file.

**LOCAL AI.** Load/unload and the model list talk to a persisted origin (`ollamaHost` in `dashboard.json`, `omarchy-shell infomarchy setOllamaHost` / `getOllamaHost`), else `OLLAMA_HOST`, else `http://127.0.0.1:11434`. Topic refinement still requires loopback unless `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1`. A loopback port that is an SSH tunnel is treated as local.

**CONTAINERS.** Lower-right card lists Docker (or Podman) containers with a per-row on/off toggle. Start and stop go through `container-control.ts`, which checks a live `ps -a` inventory and passes the name as its own argv element. Compose services show as short labels. At most eight rows. The snapshot keeps id, name, label, service, project, image, state, running, and health. Compose working_dir, env files, commands, mounts, and ports are dropped. Hide or reorder it from the module strip like the other right-column cards. Skip collection with `INFOMARCHY_SKIP_CONTAINERS=1`.

**MEDIA CONTROLS.** Last right-column card. Live MPRIS (`Quickshell.Services.Mpris`): title, artist, album, player identity, PREV / PLAY or PAUSE / NEXT. Prefers a playing player over `playerctld`. No album art fetch. Stream privacy leaves those fields in the clear. Not on Web Mode. Hide or reorder it from the module strip like the other right-column cards.

**Web Mode.** Tap **WEB** on the strip, or use **SETTINGS** / the Infomarchy bar widget. Overlay **COPY URL** (or `omarchy-shell infomarchy getWebUrl`) gives the LAN token URL. Never print that URL in logs, commits, or chat. The page matches the SUPER+D desk: two columns at desktop width, theme colors, wallpaper at 0.32 opacity with `cover` and center crop. `-` / `%` / `+` zoom the page (kept in the tab). Strip chips show and hide sections. On a narrow viewport the cards stack and each card has UP/DOWN. Those layout choices POST to `dashboard.json`. USAGE shows the TOKENS · 7 days graph only. The desk still has the $ VALUE toggle. PRIVACY is on by default and hides WAN, LAN, SSID, `user@host`, home mounts, and recent-task prompts after the first four words, same as the desk. Those fields remain in the HTML source when PRIVACY is on. Session topics stay. GitHub login is never shown. MEDIA is never on the page. Source IPs must be loopback, RFC1918, or Tailscale CGNAT (`100.64.0.0/10`). Extra CIDRs from SETTINGS or `omarchy-shell infomarchy setWebCidrs 10.x.x.x/24`. Tokens live in `$XDG_STATE_HOME/infomarchy/web.json` (0600), not in argv. Turning WEB off stops the listener and keeps tokens. Revoke a token to rotate it. Incoming TCP 8787 must be allowed on the LAN firewall (UFW defaults to deny). The git checkout and the live plugin under `~/.config/omarchy/plugins/techluddite.luddite-infomarchy` are separate trees. Copy changed files into the live plugin, then `omarchy restart shell`, if the desk is what you run.

**Grok weekly meter.** The collector reads the same billing route Grok `/usage` uses (`GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the local CLI login), at most every 60 seconds, and caches it in `$XDG_STATE_HOME/infomarchy/grok-billing.json`. Wallpaper and overlay share that file. The overlay no longer skips the fetch. If that fetch is down it uses the latest `billing: fetched credits config` line in `~/.grok/logs/unified.jsonl`, then `$XDG_STATE_HOME/infomarchy/grok-limits.json`. Local session tokens still feed today/lifetime totals. No 5-hour Grok window is invented.

**HARD REFRESH** is the first chip on the module strip. It runs the collector with `--force-refresh`, which bypasses Grok billing, GitHub, external-IP, and local usage identity caches, re-reads Claude limits in memory, then reloads the snapshot. Live feeds (CPU, sessions, containers, Ollama) are collected on every tick already. `omarchy-shell infomarchy hardRefresh` does the same on the wallpaper collector.

**Other hardening.** Grok Bot redacts credentials before flattening markdown. `INFOMARCHY_SKIP_GITHUB=1` also skips `gh run list`. Herdr window matching requires the agent's socket. `safePrompt` also covers `github_pat_`, `xai-`, `glpat-`, `hf_`, Stripe `sk_live_`/`sk_test_`, and `npm_`. Resume uses the same project-directory guard as Open Project. Default-route interface names are shape-checked before sysfs reads. `0.0.0.0` is no longer treated as loopback Ollama.

## Install

```bash
sudo pacman -S --needed bun
omarchy plugin add https://github.com/TechLuddite/luddite-infomarchy.git --enable --yes
omarchy restart shell
```

Bind in `~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + D", "Infomarchy: AI info desk", "omarchy-shell shell toggle techluddite.luddite-infomarchy '{}'")
o.bind("SUPER + I", "Infomarchy: toggle wallpaper dashboard", "omarchy-shell infomarchy toggleDashboard")
o.bind("SUPER + SHIFT + I", "Infomarchy: stream privacy", "omarchy-shell infomarchy togglePrivacy")
```

**SUPER+SHIFT+I** hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. One press turns it on. Three presses within two seconds turn it off (the chip shows 1/3, then 2/3). Overlay ignores key-repeat so holding the chord cannot unmask. `omarchy-shell infomarchy setPrivacy false` still clears it in one shot. Recent-task prompts keep the first four words and mask the rest, including the inspect drawer. COPY EXCERPT still copies the full text. OSS project names, repos, and session topics stay. It persists in `dashboard.json`. The module strip shows **PRIVACY ON** in yellow while it is active. Web Mode PRIVACY is a separate CSS toggle and stays one click.

## Remove

```bash
omarchy plugin remove techluddite.luddite-infomarchy --yes
omarchy restart shell
```

State under `$XDG_STATE_HOME/infomarchy/` (`dashboard.json`, `github-activity.json`, `grok-billing.json`, `grok-limits.json`, `web.json`, `web-snapshot.json`, collector baselines) is left in place. A running Web Mode listener is stopped with the plugin; toggle WEB off first if you want the listener gone before remove.

## License

[MIT](LICENSE). Copyright (c) 2026 Fred Nix.
