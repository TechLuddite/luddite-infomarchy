# Infomarchy (this fork)

Plugin id `techluddite.luddite-infomarchy`. Default branch on the fork is `master`, not `main`. Upstream is `nixfred/infomarchy`.

Read `README.md` and `docs/HANDOFF.md` before changing phone view, USAGE, or privacy.

Never print a phone token URL, `web.json`, or `~/.grok/auth.json` / `~/.claude/.credentials.json` contents in chat, commits, or logs.

The live desk is a separate clone: `~/.config/omarchy/plugins/techluddite.luddite-infomarchy`. Edits here do not run until copied there (then `omarchy restart shell`). Bounce PHONE off/on rotates the token.

Do not write into `omarchy/agents/usage`. Grok billing cache is `$XDG_STATE_HOME/infomarchy/grok-billing.json`. Claude OAuth refresh is `claude -p ping --max-turns 0` when the saved access token has lapsed (`INFOMARCHY_SKIP_CLAUDE_USAGE=1` skips it).
