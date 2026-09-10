# Infomarchy roadmap

Completed features and fixes are recorded in [CHANGELOG.md](CHANGELOG.md). Current behavior and setup are in [README.md](README.md); maintenance context and verification are in [docs/HANDOFF.md](docs/HANDOFF.md).

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

## Remaining work

- [ ] Stable keyed session model: the sessions Repeater is rebuilt on every snapshot (Qt clears delegates on model replacement), which restarts animations and drops per-card state; preview paths are cached at the view level as a stopgap. (Astra finding, 2026-09-05.)
- [ ] Automatic topic refinement can race an explicit UNLOAD within the same tick and reload the model; refinement is loopback-only and capped at 6 requests, but a suppress-after-unload signal would close it fully. (Astra finding, 2026-09-05.)
- [ ] Many live sessions on a small monitor can push lower cards off screen; panels are deliberately non-scrolling, so cap visible session cards and show "+N more". (Astra finding, 2026-09-05.)

## Validation for new work

Describe the intended interaction and placement before starting a new feature. Run checks appropriate to the change: meaningful tests, bounded/credential-redacted collector output, QML/runtime behavior, real client interactions where applicable, layout at the baseline display, and performance at the normal polling cadence. Document the resulting behavior and distinguish verified behavior from remaining limitations.
