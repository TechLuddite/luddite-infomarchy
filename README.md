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

State under `$XDG_STATE_HOME/infomarchy/` (`dashboard.json`, `github-activity.json`, collector baselines) is left in place.

## License

[MIT](LICENSE). Copyright (c) 2026 Fred Nix.
