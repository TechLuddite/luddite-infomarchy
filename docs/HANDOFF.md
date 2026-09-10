# Maintenance handoff

Read [../AGENTS.md](../AGENTS.md) for repository guardrails and [../README.md](../README.md) for current behavior and setup. [WEB-MODE-SECURITY.md](WEB-MODE-SECURITY.md) records implemented security boundaries and rationale. Remaining work belongs in [../TODO.md](../TODO.md); completed changes belong in [../CHANGELOG.md](../CHANGELOG.md).

## Repository and deployment

The fork is `TechLuddite/luddite-infomarchy`, default branch `master`. Use an explicit `--repo TechLuddite/luddite-infomarchy` with `gh`; upstream `nixfred/infomarchy` is a separate publication target requiring an explicit request.

The development checkout and live plugin at `~/.config/omarchy/plugins/techluddite.luddite-infomarchy` are separate clones. Inspect both working trees before deployment and preserve unrelated local edits. Copy changed source files into the live plugin, then run `omarchy restart shell`. Source changes do not require copying runtime state. Never reset the live tree merely to make it match a commit.

Runtime settings are machine-specific; inspect them safely when needed instead of relying on historical addresses or service snapshots here. `bun web-server.ts status` reports noncredential listener readiness. Never print credential files or token addresses. Deliberate clipboard IPC is `omarchy-shell infomarchy copyWebUrl`.

## Current verified state — 2026-09-10

The user confirmed Android Manual HTTPS worked with the private-CA/IP certificate after the scoped firewall fix, and then confirmed the client successfully reopened its Tailscale dashboard URL after restoration. The live listener is back on Tailscale; the temporary CA download service is stopped and its temporary firewall rule removed. Saved Manual HTTPS certificate material and desktop user trust entries remain outside the repository; the phone's test CA may be removed from its user trust store when no longer needed. Historical “not deployed” and “phone unverified” entries below describe earlier stages and are superseded by these results.

Publication record: [fork PR #22](https://github.com/TechLuddite/luddite-infomarchy/pull/22) targets the fork's `master`, with creation and merge explicitly authorized by the user. Consult the PR for the final merge commit. The separate upstream Web Mode PR remains unsubmitted pending agreement. Its review must include README setup changes and both HANDOFF and WEB-MODE-SECURITY; do not publish local PKI, runtime state or credential-bearing test artifacts.

## Source map

| Area | Entry points and constraints |
| --- | --- |
| Web disclosure and rendering | `web-page.ts`: preference parsing, `filterWebSnapshot`, page/CSP script, theme, layout. HTML and JSON use the same privacy policy; desktop snapshots remain intact. |
| HTTP listener and credentials | `web-server.ts`: LAN/loopback binding, authentication, Host/Origin, layout-only POST, bounded credential reads, revocation, process-validated `web-status.json`. |
| Manual HTTPS | `web-manual.ts`: existing PEM/key validation, SHA-256 leaf pin, SAN/key/date/chain checks and protected descriptor reads. `SettingsBody.qml`: saved setup and read-only certificate check; `web-server.ts`: direct TLS on a private/loopback bind with the existing request/disclosure boundaries. |
| Private HTTPS | `web-tailscale.ts`: bounded read-only CLI inspection, origin validation, conflict detection. `web-child.py`: Linux parent-death ownership of the foreground Serve process. |
| State mutations | `dashboard-state.ts`: validated field/per-key patches shared by QML and browser prefs. `state-lock.ts`: descriptor-held flock with bounded wait. `web-server.ts`: every credential mutation reads/writes inside `web-config.lock`; no public stale-snapshot writer. |
| Settings and lifecycle | `InfoSettings.qml`: persisted preferences and runtime status; `Infomarchy.qml`: service-owned listener and `retryWeb` IPC; `SettingsBody.qml`: shared setup/token/QR UI; `SettingsPanel.qml`: panel sizing; `InfoView.qml`: strip status. |
| Other desktop modules | Collector and QML behavior is summarized in AGENTS: USAGE/OAuth, Hermes/Pi, LOCAL AI, privacy, containers, media. Keep those boundaries when modifying shared snapshot/settings code. |

`webEnabled` expresses the requested state, `webStarting` a running setup attempt, and `webReady` confirmed readiness. Failure is visible as WEB FAILED with RETRY SETUP. Retry restarts through the service without overwriting its running binding; prerequisite inspection is read-only. Preflight checks are hidden during startup and readiness so the owned Serve mapping is not reported as somebody else's conflict.

## Verification record — 2026-09-10

- `bun test`: 264 passed across 18 files. Includes response-byte privacy sentinels, actual listener privacy transitions, browser mutation rejection, revocation/malformed credential state, external HTTPS Host/Origin boundaries, Serve conflicts, missing/failed setup without LAN fallback, repeated enable/disable, and owned-child cleanup on SIGTERM/SIGKILL.
- `web-retry.test.ts` runs a real offscreen Quickshell with a mocked web-server helper and the actual QML lifecycle: failure → retry → ready → WEB off, including duplicate retry clicks. It skips when `/usr/bin/quickshell` is absent; a skipped test is not runtime validation.
- Headless Chromium with synthetic data verified initial privacy, desktop off/on changes through the actual five-second DOM swap, read-only privacy status, and a 390px mobile layout without horizontal overflow.
- Live LAN HTML/JSON privacy checks found none of the tested identity/network/full-prompt values. The original desktop privacy setting was restored afterward.
- Live shell loaded the changes without matching plugin runtime errors. The shared SettingsBody was visually checked in a temporary 540px Quickshell harness. The actual bar widget's anchoring was not visually checked because that widget was not installed in the bar.
- The user verified real private HTTPS on desktop and phone, using the Omarchy Tailscale installer and the Tailscale enrollment/Infomarchy dashboard QR flows. An initial attempt correctly identified disabled HTTPS certificates; enabling them allowed successful setup. This is user-reported end-to-end verification, separate from automated mocks.
- The failed-setup retry improvement was subsequently deployed and the shell restarted. The live Tailscale listener reported ready, and an HTTPS HEAD request returned 200 with normal certificate verification and `Cache-Control: no-store`. No credential URL was logged.

Keep future test claims scoped to what was actually exercised. The settings-write race was subsequently fixed as recorded below; unrelated follow-ups remain in TODO.

## Upstream 1.3.2 sync — 2026-09-10

- Merged upstream `f8447af` (dense desktop session cards above eight visible sessions). Retained fork path privacy, clipping, minimum-width constraints, plugin identity, and fork changelog structure; manifest now reports 1.3.2.
- `bun test`: 265 passed, 0 failed across 18 files, including the Quickshell retry regression and upstream density arithmetic guard. `git diff --check` passed. Dense mode was not visually exercised with more than eight sessions.
- Backed up and copied the four changed upstream-integration files to the separate live clone, preserving its existing local edits and extra files, then restarted the shell. Desktop geometry IPC responded; noncredential Web Mode status reported Tailscale running and ready.

## Settings and credential mutation fixes — 2026-09-10

- Replaced cached whole-file QML saves with field/per-key patches. `dashboard-state.ts` reads and merges inside `dashboard.lock`, shared with browser layout updates. Privacy, WEB-off and access-mode choices survive unrelated stale edits; separate map edits merge and explicit unpins remain deleted. QML has an explicit in-flight guard covering helper startup, queues subsequent edits, and reloads saved state on completion/failure. Failed saves are shown in the module strip and settings panel.
- All viewer-token/CIDR/listener-state changes read and publish inside `web-config.lock`. The whole-config writer is private to those transactions. Persistent descriptor-validated lock files use flock, a bounded wait, and kernel cleanup on process death.
- `bun test`: 272 passed, 0 failed across 19 files. New tests run competing actual helper processes behind held locks, preserve revocation during token/CIDR/listener changes, reject hostile lock symlinks and invalid state, verify crash release and map pruning, and run two actual offscreen QML instances for stale writes and failed-save recovery. Existing server privacy and lifecycle tests also passed. `git diff --check` passed.
- This verification used isolated temporary state. Changes are in the development checkout only; the live plugin has not been updated by this fix. No upstream PR or remote publication was performed.

## Manual HTTPS and live verification — 2026-09-10

- Added the third access mode (`manual`) using existing certificates, with persisted `manualHttps` settings and a read-only CHECK CERTIFICATE action. Hostname, private/loopback bind, port, PEM chain/key paths and exact SHA-256 leaf fingerprint are operator-supplied. No plugin issuance, DNS, firewall or client-trust management. File reads hold parent descriptors and reject symlinks/unsafe keys; startup verifies SAN/key/fingerprint/dates/chain signatures. Existing Host/Origin, source, token, privacy and layout-only browser boundaries remain. Saving certificate settings disables an active manual listener; expiry blocks responses immediately and stops the listener within 30 seconds.
- `bun test`: 279 passed, 0 failed across 20 files. Manual regressions include a real CA-verified TLS listener, negative certificate/file cases, no HTTP fallback, request boundaries, and an actual offscreen Quickshell settings form that saves/checks the certificate then returns to Tailscale mode with WEB off. The form test uses style/color stubs and synthetic state; it does not prove real bar anchoring. The earlier mutation fixes are included.
- Deployed changed/new source files to the separate live plugin with backups, preserving existing live content and runtime state. Restarted the shell and exercised real Manual HTTPS using `infomarchy.localhost` on loopback port 8789. A certificate-verified authenticated HEAD returned 200. An isolated Chromium profile rendered the authenticated dashboard using normal certificate verification and the user's NSS trust store; no insecure browser flags or certificate bypasses were used.
- At the user's request, created a local test CA/leaf under `$XDG_STATE_HOME/infomarchy/pki/localhost-test/`, outside the repository. The CA has a DNS name constraint for `infomarchy.localhost`; the leaf is valid for 90 days and the CA for one year. Added that CA to the user's NSS trust store, with its prior databases backed up in the protected certificate directory. CA/key setup was a one-time user-authorized task, not functionality added to the plugin. The directory's README records removal of the user trust entry. System trust, DNS and firewall configuration were not changed. Other devices and Firefox trust were not tested or configured.
- Restored the original Tailscale access mode, WEB-enabled state and privacy choice after testing. The restored endpoint returned authenticated HTTPS HEAD 200 with normal certificate verification. Listener readiness can precede the first collector snapshot; live probes waited through the expected temporary 503 while collecting. Manual certificate configuration remains saved for later use. No viewer credential URL was printed, and no upstream PR or remote publication was performed.

### IP-address phone test — 2026-09-10

Manual HTTPS now accepts a private IPv4 identity and requires an exact IP SAN for it; DNS-only SANs cannot authenticate an IP. README documents the DNS-free setup and address-change/renewal requirement. `bun test`: 281 passed across 20 files, including real TLS for DNS and IP identities and the QML form regression.

Deployed the IP changes to the live plugin and prepared a separate short-lived LAN test CA/certificate outside the repository. OpenSSL verified the chain/IP; curl returned authenticated HTTPS HEAD 200 and Chromium rendered the dashboard using normal user-CA trust. Bun's live HTTPS probe rejected this name-constrained CA with `UNSPECIFIED`; independent curl/Chromium checks passed. Manual HTTPS is deliberately left enabled for the user's Android test; restore Tailscale after the user finishes. Phone reachability/trust remains unverified. A temporary user service `infomarchy-test-ca` serves only the public CA download on LAN port 8790, expires after two hours, and should be stopped after testing. Test files are under the user's state `infomarchy/pki/lan-test`; user NSS nickname is `Infomarchy LAN test CA 2026-09-10`. No plugin certificate-management feature was added; no PR submitted.

### Android result and self-managed CA guide — 2026-09-10

The user confirmed successful Manual HTTPS viewing on Android after installing the test CA and correcting the desktop firewall. Kernel UFW logs showed incoming SYNs blocked on both 8789 and the temporary CA download port 8790; desktop-local HTTP/TLS probes had not exercised that boundary. A rule restricted to the phone source, desktop destination and Wi-Fi interface resolved the timeout. This is user-reported real-device verification.

README now owns a complete OpenSSL private-CA/IP-SAN setup recipe for users without DNS or Tailscale, with Android trust, a public-certificate-only download directory, fingerprint verification, scoped firewall rules, expiry/address-change handling and cleanup. Executed the certificate recipe in isolated temporary storage; OpenSSL generated and verified the IP certificate. `bun test`: 281 passed across 20 files; `git diff --check` passed. The security document records that issuance/trust/firewall operations remain operator-run.

Restored the user's Tailscale mode and enabled listener after the phone test; an authenticated HTTPS HEAD returned 200 with normal certificate verification. Stopped the temporary CA download service and removed the exact temporary combined 8789/8790 firewall rule. Saved manual certificate files remain available outside the repository; client test-CA removal is a separate user action on the phone. No upstream PR submitted.
