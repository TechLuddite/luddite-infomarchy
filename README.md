# Infomarchy

A fork of [Infomarchy](https://github.com/nixfred/infomarchy) by [Fred Nix](https://github.com/nixfred), with Larry.

The wallpaper desk, the collector, and the design are theirs. Use [the original](https://github.com/nixfred/infomarchy) unless you want the changes below. How the desk works is documented there.

<p align="center">
  <img src="preview.png" alt="Infomarchy with sanitized demo data on an empty 1080p Omarchy desktop" width="100%">
</p>

## What this fork changes

**Plugin id** is `techluddite.luddite-infomarchy`, so it does not collide with `nixfred.infomarchy`.

**USAGE** reads Grok session files (`updates.jsonl`) and OpenCode assistant token fields when Omarchy has no collector for them. Those rows are labelled `local` and have no 5-hour or weekly meters. Omarchy cache records are never overwritten, and nothing is written into `omarchy/agents/usage`. Each provider sits in its own tinted bordered block.

**Git and GitHub CI.** Observational git in an agent working tree pins `core.fsmonitor=false`, `core.hooksPath=/dev/null`, empty `diff.external` and `credential.helper`, and ignores global/system git config. `git diff` also passes `--no-ext-diff --no-textconv`. `gh run list` uses `--repo owner/name` after parsing `origin` as github.com. Non-github remotes are skipped. The agent's cwd is not the `gh` process cwd.

**Stream privacy.** SUPER+SHIFT+I (or `omarchy-shell infomarchy togglePrivacy`) hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. OSS project names stay.

**Pi.** Live sessions and recent prompts come from the Pi agent (`~/.pi/agent/sessions`). The default recent-task window keeps each provider's newest prompts, including OpenCode.

**Phone view.** Tap **PHONE** on the strip. Overlay **COPY PHONE URL** (or `omarchy-shell infomarchy getWebUrl`) gives `http://<lan-ip>:8787/t/<token>/`. Read-only. Source IPs must be loopback, RFC1918, or Tailscale CGNAT (`100.64.0.0/10`). Add a VPN VLAN with `omarchy-shell infomarchy setWebCidrs 10.x.x.x/24` and toggle PHONE off/on. PRIVACY is on by default and hides WAN, LAN, SSID, `user@host`, and home mounts. GitHub login is never shown. USAGE meters match the desk without the 7-day charts. The page swaps in place every 5s and keeps scroll. Refresh is also a link. Token lives in `$XDG_STATE_HOME/infomarchy/web.json` (0600), not in argv. Incoming TCP 8787 must be allowed on the LAN firewall (UFW defaults to deny).

**Grok weekly meter.** The collector reads the same billing route Grok `/usage` uses (`GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the local CLI login), at most every 15 minutes, and caches it in `$XDG_STATE_HOME/infomarchy/grok-billing.json`. If that fetch is down it uses the latest `billing: fetched credits config` line in `~/.grok/logs/unified.jsonl`, then `$XDG_STATE_HOME/infomarchy/grok-limits.json`. Local session tokens still feed today/lifetime totals. No 5-hour Grok window is invented.

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

**SUPER+SHIFT+I** hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. OSS project names, repos, and session topics stay. It persists in `dashboard.json` until toggled off. The module strip shows **PRIVACY ON** in yellow while it is active.

## Remove

```bash
omarchy plugin remove techluddite.luddite-infomarchy --yes
omarchy restart shell
```

State under `$XDG_STATE_HOME/infomarchy/` (`dashboard.json`, `github-activity.json`, `grok-billing.json`, `grok-limits.json`, `web.json`, `web-snapshot.json`, collector baselines) is left in place. A running phone view is stopped with the plugin; toggle PHONE off first if you want the listener gone before remove.

## License

[MIT](LICENSE). Copyright (c) 2026 Fred Nix.
