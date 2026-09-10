# Web Mode security design

Implemented design agreed on 2026-09-09, verified on 2026-09-10. See [HANDOFF.md](HANDOFF.md) for the source map and validation record, and [README setup](../README.md#set-up-web-mode) for user instructions.

## Scope and rationale

Web Mode supports two mutually exclusive access modes: trusted LAN HTTP and private HTTPS through Tailscale Serve. Desktop-owned privacy is enforced before responses leave the server. Network reachability, transport encryption, and viewer-token authorization are separate checks.

Tailscale owns private connectivity and HTTPS certificate lifecycle; Infomarchy owns disclosure, viewer credentials, and its forwarding process. This keeps setup bounded without DNS-provider credentials, local trust-store installation, or certificate renewal machinery inside the plugin. Public exposure, Funnel, built-in CA/ACME, pairing-to-cookie sessions, and per-viewer roles are outside this implementation. They are not pending approved requirements.

## Disclosure policy

Only literal boolean `false` in persisted desktop `privacyMode` disables privacy. Missing, unreadable, invalid, or malformed settings default to on. The browser's privacy label is read-only; the layout preference endpoint rejects unexpected keys, including privacy mutations.

`filterWebSnapshot` applies a shared disclosure policy to HTML and JSON without modifying the desktop source snapshot. With privacy on, it omits WAN/LAN addresses, SSID and user/host identity, shortens home mounts, and truncates recent prompts after four words using the existing mask. Hidden elements, attributes, scripts, and JSON must not retain full values. Session topics, project names, and short prompts remain visible by design; this is partial disclosure, not comprehensive anonymization.

GitHub login and media remain excluded at either privacy setting. JSON sessions, attention, and usage are projected to web fields rather than forwarding desktop action arguments, working directories, previews, or extra provider data. Containers remain a displayed status card. Desktop COPY EXCERPT retains full text.

Privacy off permits connected viewers to receive the allowed full values. Changes apply to subsequent responses, normally the next successful five-second refresh. Already received/saved data cannot be retracted; disconnected pages may retain old content. Privacy filtering does not encrypt HTTP transport.

## Access boundaries

### LAN HTTP

The backend binds IPv4 `0.0.0.0`, default port 8787. Source defaults are loopback and RFC1918, with explicit extra CIDRs available. `100.64.0.0/10` is not default-allowed and never proves tailnet membership. CIDRs are reachability filters. The user manages firewall rules; loading settings or enabling WEB does not change them. Data and bearer credentials travel unencrypted.

### Private HTTPS

The backend binds `127.0.0.1`. A dedicated foreground `tailscale serve --https=8788 http://127.0.0.1:8787` process provides private HTTPS. The application requires a loopback TCP peer, the exact HTTPS Host/Origin derived from local Tailscale status, and a valid viewer token. It does not trust forwarded or Tailscale identity headers. A local process holding a token can access loopback with the correct Host; this does not isolate the service from other processes running as the user.

Inspection checks the installed CLI, connection, DNS name, required Serve options, and existing Serve configuration using bounded subprocesses. Existing TCP/Web/Funnel mappings on 8788, including nested foreground mappings, cause refusal. Unrelated services are preserved. No existing background mapping is adopted, no global Serve reset is run, and Funnel is never enabled.

`web-child.py` sets Linux parent-death SIGKILL and checks the parent PID before executing the CLI. Normal listener shutdown and abrupt listener death terminate the owned process; tailscaled removes its foreground mapping when the CLI connection closes. Plugin removal ends that ownership too. Tailscale itself and unrelated services continue running.

Startup waits for the expected foreground mapping and verifies that it is not Funnel before reporting ready. A failed setup exits without LAN fallback. Selecting another access mode turns WEB off. Installation, login, admin HTTPS/MagicDNS changes, and local permissions are guided rather than automatically changed or escalated.

## Credentials, requests, and UI

Viewer tokens are individually revocable bearer credentials stored in `web.json` with mode 0600. Credential reads validate the opened descriptor, ownership, link count, mode, and bounded size; symlinks and invalid files fail closed. Rejected state is not silently replaced with new credentials or stale cached tokens. Revocation affects subsequent authenticated requests. WEB off keeps credentials; add a replacement before revoking the last token.

Page access is GET/HEAD. The JSON-only POST `/prefs` requires the expected Origin and accepts only `webSections` and `webNarrowOrder`. Existing escaping, request limits, authentication, no-store responses, and nonce CSP remain. `connect-src 'self'` and `img-src 'self'` restrict page fetches. Rate-limit bookkeeping is bounded and distinguishes authenticated viewers behind the loopback proxy.

`web-status.json` contains noncredential runtime state validated against the live process identity. Routine startup/status output and QML polling contain no token URLs. Deliberate COPY URL/SHOW QR fetches the selected viewer address; `copyWebUrl` replaces URL-returning IPC. QR is cleared when hidden, settings closes, or the selection/mode changes. Dashboard QR opens the authenticated page; it does not enroll or authorize a Tailscale device.

Requested-on, starting, ready, and failed are distinct UI states. WEB FAILED offers RETRY SETUP after the user fixes a prerequisite; CHECK PREREQUISITES only inspects. Retry uses the service-owned listener lifecycle, preserves WEB-off guards, and ignores duplicate/ready retries. Preflight checks are hidden during starting/ready to avoid treating the owned active mapping as a conflict.

## Validation expectations

For future changes, test distinctive private sentinels against actual HTML/JSON response bytes, privacy transitions, allowed four-word/topic disclosure, and browser mutation attempts. Preserve credential/revocation, Host/Origin, CSP, malformed-state, bounded-output, and shutdown tests. Exercise absent/stopped/signed-out Tailscale, conflicts, setup failures, repeated enable/disable, direct-backend boundaries, and crash cleanup. Unit/mocked tests do not replace real-device or QML verification; current evidence and limits are recorded in HANDOFF.

Reference: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve) and [HTTPS prerequisites](https://tailscale.com/docs/how-to/set-up-https-certificates).
