# Maintenance handoff

Read [../AGENTS.md](../AGENTS.md) for repository guardrails and [../README.md](../README.md) for current behavior and setup. [WEB-MODE-SECURITY.md](WEB-MODE-SECURITY.md) records implemented security boundaries and rationale. Remaining work belongs in [../TODO.md](../TODO.md); completed changes belong in [../CHANGELOG.md](../CHANGELOG.md).

## Repository and deployment

The fork is `TechLuddite/luddite-infomarchy`, default branch `master`. Use an explicit `--repo TechLuddite/luddite-infomarchy` with `gh`; upstream `nixfred/infomarchy` is a separate publication target requiring an explicit request.

The development checkout and live plugin at `~/.config/omarchy/plugins/techluddite.luddite-infomarchy` are separate clones. Inspect both working trees before deployment and preserve unrelated local edits. Copy changed source files into the live plugin, then run `omarchy restart shell`. Source changes do not require copying runtime state. Never reset the live tree merely to make it match a commit.

Runtime settings are machine-specific; inspect them safely when needed instead of relying on historical addresses or service snapshots here. `bun web-server.ts status` reports noncredential listener readiness. Never print credential files or token addresses. Deliberate clipboard IPC is `omarchy-shell infomarchy copyWebUrl`.

## Source map

| Area | Entry points and constraints |
| --- | --- |
| Web disclosure and rendering | `web-page.ts`: preference parsing, `filterWebSnapshot`, page/CSP script, theme, layout. HTML and JSON use the same privacy policy; desktop snapshots remain intact. |
| HTTP listener and credentials | `web-server.ts`: LAN/loopback binding, authentication, Host/Origin, layout-only POST, bounded credential reads, revocation, process-validated `web-status.json`. |
| Private HTTPS | `web-tailscale.ts`: bounded read-only CLI inspection, origin validation, conflict detection. `web-child.py`: Linux parent-death ownership of the foreground Serve process. |
| Settings and lifecycle | `InfoSettings.qml`: persisted preferences and runtime status; `Infomarchy.qml`: service-owned listener and `retryWeb` IPC; `SettingsBody.qml`: shared setup/token/QR UI; `SettingsPanel.qml`: panel sizing; `InfoView.qml`: strip status. |
| Other desktop modules | Collector and QML behavior is summarized in AGENTS: USAGE/OAuth, Hermes/Pi, LOCAL AI, privacy, containers, media. Keep those boundaries when modifying shared snapshot/settings code. |

`webEnabled` expresses the requested state, `webStarting` a running setup attempt, and `webReady` confirmed readiness. Failure is visible as WEB FAILED with RETRY SETUP. Retry restarts through the service without overwriting its running binding; prerequisite inspection is read-only. Preflight checks are hidden during startup and readiness so the owned Serve mapping is not reported as somebody else's conflict.

## Verification record — 2026-09-10

- `bun test`: 264 passed across 18 files. Includes response-byte privacy sentinels, actual listener privacy transitions, browser mutation rejection, revocation/malformed credential state, external HTTPS Host/Origin boundaries, Serve conflicts, missing/failed setup without LAN fallback, repeated enable/disable, and owned-child cleanup on SIGTERM/SIGKILL.
- `web-retry.test.ts` runs a real offscreen Quickshell with a mocked Tailscale helper and the actual QML lifecycle: failure → retry → ready → WEB off, including duplicate retry clicks. It skips when `/usr/bin/quickshell` is absent; a skipped test is not runtime validation.
- Headless Chromium with synthetic data verified initial privacy, desktop off/on changes through the actual five-second DOM swap, read-only privacy status, and a 390px mobile layout without horizontal overflow.
- Live LAN HTML/JSON privacy checks found none of the tested identity/network/full-prompt values. The original desktop privacy setting was restored afterward.
- Live shell loaded the changes without matching plugin runtime errors. The shared SettingsBody was visually checked in a temporary 540px Quickshell harness. The actual bar widget's anchoring was not visually checked because that widget was not installed in the bar.
- The user verified real private HTTPS on desktop and phone, using the Omarchy Tailscale installer and the Tailscale enrollment/Infomarchy dashboard QR flows. An initial attempt correctly identified disabled HTTPS certificates; enabling them allowed successful setup. This is user-reported end-to-end verification, separate from automated mocks.
- The failed-setup retry improvement was subsequently deployed and the shell restarted. The live Tailscale listener reported ready, and an HTTPS HEAD request returned 200 with normal certificate verification and `Cache-Control: no-store`. No credential URL was logged.

Keep future test claims scoped to what was actually exercised. The known settings-write race and other unrelated follow-ups remain in TODO.
