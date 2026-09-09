# Infomarchy interactive command-desk roadmap

Work is deliberately sequential. A feature may move to `done` only after its
unit tests, collector snapshot, QML/runtime load, live behavior, data safety, and
performance checks are clean. Before the next feature starts, its interaction
and screen placement are described in the work log/conversation.

## Screen architecture

- Target the real baseline display: 1920×1080 at scale 1.
- Keep one compact module strip above the existing two-column overview.
- Every full card is a registered module and can be removed/restored from the
  strip; choices persist in the Infomarchy state file.
- New detail-heavy features use drawers, popovers, filters, or hover previews.
  They do not permanently add another vertical card to the overview.
- The recent-task list remains the flexible-height section and absorbs layout
  changes without forcing the dashboard off screen.
- Background and fullscreen-overlay views share the same module preferences.

## Quality gate for every feature

- [x] Unit tests cover success, unavailable-data, stale-window, and malformed-data paths.
- [x] Collector emits valid, credential-redacted JSON with optional providers absent.
- [x] QML loads without runtime warnings or binding errors.
- [x] Live behavior is verified against a real Hyprland client when applicable.
- [x] Prompt text remains credential-redacted before display.
- [x] Collector runtime and output size remain reasonable for the 3–4 second poll.
- [x] README documents the behavior and controls.

## Sequential features

- [x] Foundation: persistent add/remove controls for every section.
- [x] Gate 0: live prompt rows focus their exact session window.
- [x] 1. Closed-session Resume for Claude, Codex, Grok, opencode, and other safely supported providers; add opencode history/live tracking.
- [x] 2. Clickable heatmap filtering by hour and provider.
- [x] 3. Expandable live-session inspector and safe window/project actions.
- [x] 4. Workspace focus/move actions; the later duplicate compact map was retired in favor of large cards only.
- [x] 5. Needs You inbox with faint glow, focus, snooze, and dismiss.
- [x] 6. Prompt-row actions: focus/resume, copy, pin, session grouping, and project open.
- [x] 7. Per-agent CPU, RAM, process, and GPU attribution.
- [x] 8. Interactive usage forecasting, display modes, and provider filtering.
- [x] 9. Optional blurred still window previews on hover.
- [x] 10. Global command strip and keyboard navigation.
- [x] Final complete regression, performance, data-safety, and documentation pass.

## This fork, shipped 2026-09-07

- [x] Stream privacy SUPER+SHIFT+I. One press on, three presses within 2s off.
- [x] Pi sessions and recent-task fairness for OpenCode and Pi.
- [x] LAN phone view: token URL, CIDR allowlist, Host/Origin, CSP, GET/HEAD.
- [x] Phone USAGE meters without 7-day charts. PRIVACY chip. MACHINE meter grid. Same-origin HTML swap instead of meta refresh.
- [x] Grok weekly/build meters from CLI billing (`cli-chat-proxy.grok.com`), cache `grok-billing.json`.
- [x] Overlay SUPER+I while the layer has exclusive keyboard focus.
- [x] Claude USAGE: refresh lapsed CLI OAuth via `claude -p ping --max-turns 0`, then re-read Omarchy limits. Do not write `omarchy/agents/usage`.
- [x] Stream privacy: RECENT TASKS · WHAT GOT ASKED keeps the first four words and masks the rest.
- [x] LOCAL AI: persist `ollamaHost` (this machine: Pi tunnel `127.0.0.1:11435`).
- [x] Claude USAGE: drop Omarchy's leftover `Run claude auth login` help unless a real status is set.
- [x] CONTAINERS: lower-right card, per-row on/off for Docker/Podman.
- [x] Stream privacy: three SUPER+SHIFT+I within 2s to disable. Chip shows 1/3 then 2/3. `setPrivacy false` is the one-shot off.
- [x] Grok billing 60s cache, overlay fetches too. HARD REFRESH chip bypasses cached feeds.
- [x] MEDIA CONTROLS: last right-column card, live MPRIS prev/play/next and title.

## Follow-up batch

- [x] 11. Recent Tasks: 80-row scrollback, text/project/provider search, and a visible, draggable scrollbar.
- [x] 12. Activity: show the hovered cell breakdown beside the pointer instead of in the far-right legend.
- [x] 13. Network: display the host's external IP and cache success/failure responsibly.
- [x] 14. Persistence: SUPER+I visibility survives Infomarchy and unrelated shell/plugin restarts without flipping.
- [x] 15. Layout: persistently reorder Usage, Local AI, and Machine with snappy vertical drag-and-drop.
- [x] 16. Local AI controls: select, load, and unload installed Ollama models safely from the card.
- [x] 17. Live-session topics: derive exact-session context for each large agent card.
- [x] 18. Recent Tasks scrolling: route wheel/touchpad input directly through clickable rows and enlarge the draggable track.
- [x] 19. Recent Tasks input fix: replace row-covering MouseAreas with non-blocking hover/tap handlers and accelerate smooth scrolling.
- [x] 20. Live-session cleanup: remove the duplicate compact workspace/session strip and keep only large per-session cards.
- [x] 21. Real session synopsis: summarize several exact-session requests into a short phrase, optionally refined by an already-loaded Ollama model; never display the last prompt as the topic.
- [x] 22. Proactive alerts: persistently deduplicate attention, crash, review, and ended-session notifications with global, quiet-hours, and per-provider controls.

- [ ] Settings ownership: wallpaper and overlay each hold an InfoSettings copy of dashboard.json and write the whole file; two near-simultaneous writes (a notification claim + a section toggle) can clobber one another. Centralize writes in the service or read-merge-write with a revision. (Second-reviewer finding, 2026-09-05.)
- [ ] Stable keyed session model: the sessions Repeater is rebuilt on every snapshot (Qt clears delegates on model replacement), which restarts animations and drops per-card state; preview paths are cached at the view level as a stopgap. (Astra finding, 2026-09-05.)
- [ ] Automatic topic refinement can race an explicit UNLOAD within the same tick and reload the model; refinement is loopback-only and capped at 6 requests, but a suppress-after-unload signal would close it fully. (Astra finding, 2026-09-05.)
- [ ] Many live sessions on a small monitor can push lower cards off screen; panels are deliberately non-scrolling, so cap visible session cards and show "+N more". (Astra finding, 2026-09-05.)
- [x] Web Mode: desk-matching HTML, SETTINGS/bar widget, multi-token, QR, extra CIDRs, independent web section visibility. Turning WEB off keeps tokens.
- [x] Web Mode zoom, in-page section chips, narrow UP/DOWN order, recent-task privacy mask.
- [ ] Web Mode HTML still embeds WAN/LAN/SSID/`user@host` in `.open` spans while PRIVACY is on (CSS hide only). Keep `maskSnapshot` on the HTML and fetch identity only after PRIVACY is off.
- [ ] Drop `100.64.0.0/10` from phone default CIDRs unless this host actually uses Tailscale. VPN VLAN CIDR is still unset.
- [ ] Live plugin clone under `~/.config/omarchy/plugins/techluddite.luddite-infomarchy` drifts from this git checkout. Copy or reinstall after landing on `master`.
