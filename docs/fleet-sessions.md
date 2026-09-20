# FLEET sessions: which remote agent needs you

`fleet-remote.ts` answers *is anything running over there*. This answers *which
one is waiting on me, and how do I get to it*.

The two are separate files, separate probes and separate failure modes on
purpose. This document is why.

## The question the ps probe cannot answer

The FLEET card that shipped reads one bounded `ps -eo pid=,args=` over SSH and
matches it with `providerOf()`. That is a genuinely good floor: it needs nothing
on the far end but a shell, so it works against a Raspberry Pi, a build box, or
a VPS somebody else administers.

What it produces is a count. A dev box running three Claude sessions reads:

```
OVH   ● Claude ×3                        12s
```

Which is enough to know the machine is busy, and not enough to act. Locally,
Infomarchy has answered the harder question for a long time — the session cards
carry busy and needs-you state, and clicking one focuses the exact tmux pane.
The information gap between a local session and a remote one is not conceptual.
It is only that `ps` output does not carry it.

So this asks the remote machine's own Infomarchy, which already knows:

```
OVH   ● Claude ×3                        12s
 └ ● ra-omarchy                  working
 └ ● personal          NEEDS YOU
 └ ● ridgetopai                  working
```

## Layering, not replacing

| | requires on the far end | produces |
|---|---|---|
| `ps` probe (`fleet-remote.ts`) | ssh, a POSIX shell | provider counts |
| session probe (`fleet-sessions.ts`) | ssh, bun, Infomarchy | sessions |

A host that cannot answer the richer probe keeps its `ps` row **exactly** as it
is today. That is the whole compatibility story, and it is enforced in one
place: `mergeFleetSessions()` returns the row untouched unless the probe came
back `ok`. Nothing about the merged feature changes when this is unavailable,
unconfigured, or broken.

`unsupported` is therefore a status, not an error:

- **ok** — the host answered with sessions.
- **unsupported** — reachable, but no bun, no collector, or an older Infomarchy
  that does not know the flag. Re-asked every 10 minutes, not every 30 seconds:
  a machine without Infomarchy will not grow one in the next tick, and a fleet
  of plain ssh boxes should not cost a probe apiece every refresh.
- **error** — unreachable or the probe failed. Same handling, normal interval.

Per-host scheduling, not per-store: one unreachable host does not hold back
another host's refresh, and a host on backoff is skipped entirely rather than
probed and discarded.

## The wire shape, and the privacy boundary

This is the point where session data leaves a machine, so the row carries
**less** than a local card does, and exactly one function builds it
(`fleetSessionRowFromLocal`). Everything omitted is omitted deliberately:

| crosses | does not cross |
|---|---|
| provider | the window title |
| project basename | the attention *detail* (which quotes the title) |
| attention state + its canned reason | prompt or task text, in any form |
| busy, stale, uptime | cwd or any absolute path |
| tmux session/window/pane | git state, resources, session ids |

The attention *state* crosses because it is the entire point; the *detail*
does not, because on a local card it is the window title, and a window title is
the one piece of an agent's screen most likely to quote what you typed. The
project basename crosses because "which box, which project" is the question, and
a basename is not a path. The tmux names cross because they are the address the
jump needs — and the operator chose them.

Two properties keep this honest rather than aspirational:

1. **The remote enforces it too.** `collector.ts --fleet-sessions` builds the
   same bounded row with the same function. A remote does not ship its whole
   snapshot and trust the receiver to trim it.
2. **The receiver re-validates anyway.** Every field off the wire is clamped,
   length-capped, stripped of control characters, and type-checked; unknown
   attention states become no signal; hostile tmux ids are dropped rather than
   escaped. A malicious or simply mismatched remote cannot widen the boundary,
   and cannot inject anything into the desk that a row was not shaped to hold.

There is a test for each of those claims, including one that asserts a window
title, an attention detail quoting an SSH key path, a home path and a git branch
are all absent from a real payload built from a session carrying them.

## The probe

```
B=$(command -v bun || echo "$HOME/.bun/bin/bun"); [ -x "$B" ] || { echo FLEET_SESSIONS_UNSUPPORTED; exit 0; }
[ -f "<collector>" ] || { echo FLEET_SESSIONS_UNSUPPORTED; exit 0; }
"$B" "<collector>" --fleet-sessions 2>/dev/null | head -c 131072
```

Notes on each part, since every one of them is a decision:

- **The bun fallback.** A non-interactive `ssh host command` does not read
  `.bashrc`, so bun installed to `~/.bun/bin` is not on `PATH` — the probe finds
  it there rather than asking operators to restructure their remote shell
  profile. This was found by running the probe, not by reasoning about it.
- **Explicit unsupported, exit 0.** A missing bun is a normal state, not a
  failure, and it must be distinguishable from "the host is down". Printing a
  sentinel makes that distinction survive SSH's own exit codes.
- **`head -c` on the far end**, and the local runner bounds it again. Same
  two-sided bound the `ps` probe uses.
- **The collector path** is the standard plugin install path, overridable with
  `INFOMARCHY_FLEET_REMOTE_PATH` for a non-standard one. It is shell-quoted into
  the command, so it is validated against a plain-path pattern first; a value
  with a quote or a `$(` in it is refused and the default is used.

`--fleet-sessions` runs the session scan **only**. No machine telemetry, no
network checks, no Ollama, no GitHub or Gitea, no history walk. A probe that
costs a full tick on every remote host every refresh is one nobody could afford
to leave on; measured at 0.65 s on a live 3-session host.

## The jump

The local jump is: focus the terminal, then `tmux select-window` / `select-pane`
so the agent is actually on screen. The remote jump is that same jump displaced
by one hop — open a terminal, `ssh -t`, run the same selects over there, and
`exec` the attach so the terminal shows tmux rather than a shell behind it.

Ids are validated twice: once in `fleet-sessions.ts` on the way in (a name that
is not plainly a tmux name is dropped, and its row simply becomes unclickable),
and again in `InfoModel.qml`, because that is where they become a command line.
Dropping beats escaping here — there is no legitimate tmux session named
`ridge; rm -rf /`, so nothing of value is lost by refusing it.

A row without tmux is not a failure either. It renders, it just does not click,
the same way a local card with no window reports *no window* rather than
guessing one.

## Verified

- Live across two machines: an Omarchy desktop probing a Tailscale dev box
  running three real Claude sessions in tmux. Session rows, project names, tmux
  addresses and busy state all correct against `tmux list-panes` on the far end.
- Remote emit mode: 0.65 s, single bounded line, no titles or paths in the
  payload.
- `bun test`: 422 pass / 0 fail on an Omarchy desktop with the Qt gates
  available (the QML gates do not run on a headless box).
- The ps-only fallback: a host with no bun reports `unsupported` and keeps its
  original row, asserted in tests rather than only reasoned about.

## Not covered

- **Topics.** The local cards show a derived session synopsis. That is prompt-
  derived text, and it belongs in a separate discussion about what may cross a
  machine boundary, not folded in here quietly.
- **Actions.** Remote stop/resume are deliberately absent. The jump takes you
  there; the destructive verbs stay where the process is.
- **Windows for remote sessions.** Hyprland state is local by definition; a
  remote session's "window" is the terminal you open when you jump.
- **Herdr and Boomux hosts.** Only tmux is addressed remotely so far, because it
  is the one whose jump is a plain command over ssh. The others focus through
  local socket APIs.
