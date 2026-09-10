# Infomarchy

A fork of [Infomarchy](https://github.com/nixfred/infomarchy) by [Fred Nix](https://github.com/nixfred), with Larry.

The wallpaper desk, the collector, and the design are theirs. Use [the original](https://github.com/nixfred/infomarchy) unless you want the changes below. How the desk works is documented there.

<p align="center">
  <img src="preview.png" alt="Infomarchy with sanitized demo data on an empty 1080p Omarchy desktop" width="100%">
</p>

## What this fork changes

**Plugin id** is `techluddite.luddite-infomarchy`, so it does not collide with `nixfred.infomarchy`.

**USAGE** reads Grok session files (`updates.jsonl`) and OpenCode assistant token fields when Omarchy has no collector for them. Those rows are labelled `local` and have no 5-hour or weekly meters. If Grok has no `updates.jsonl` snaps, the row falls back to session-directory counts (`summary.json`). Observed billing limits still appear; missing limits and token counts are never invented. A provider with no token data does not show `0 tok`. Each provider can list per-model share from what it already reports. Omarchy cache records are never overwritten, and nothing is written into `omarchy/agents/usage`. Each provider sits in its own tinted bordered block. When Omarchy reports Claude Sign-in expired because the saved access token lapsed, the wallpaper collector runs one `claude -p ping --max-turns 0` (at most every 15 minutes) so the CLI can refresh OAuth, then re-reads limits. Skip with `INFOMARCHY_SKIP_CLAUDE_USAGE=1`. A leftover `Run claude auth login` help line on a successful limits probe is dropped, so USAGE does not look expired while the meters are live.

**Git and GitHub CI.** Observational git in an agent working tree pins `core.fsmonitor=false`, `core.hooksPath=/dev/null`, empty `diff.external` and `credential.helper`, and ignores global/system git config. `git diff` also passes `--no-ext-diff --no-textconv`. `gh run list` uses `--repo owner/name` after parsing `origin` as github.com. Non-github remotes are skipped. The agent's cwd is not the `gh` process cwd.

**Stream privacy.** SUPER+SHIFT+I (or `omarchy-shell infomarchy togglePrivacy`) hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. One press turns it on. Three presses within two seconds turn it off (the chip shows 1/3, then 2/3). Overlay ignores key-repeat. `omarchy-shell infomarchy setPrivacy false` still clears it in one shot. Recent-task prompts keep the first four words and mask the rest, including the inspect drawer. COPY EXCERPT still copies the full text. OSS project names stay. Web Mode follows this persisted desktop setting; its privacy status cannot be changed in the browser. Missing or invalid settings default to privacy on.

**Pi.** Live sessions and recent prompts come from the Pi agent (`~/.pi/agent/sessions`). The default recent-task window keeps each provider's newest prompts, including OpenCode.

**Hermes.** Recent prompts come from `$HERMES_HOME/state.db` or `~/.hermes/state.db`. Resume is `hermes --resume <id>`. A live Hermes card raises the Hermes app (window below the launcher, class-gated) and reads the session id from the lease file.

**LOCAL AI.** Load/unload and the model list talk to a persisted origin (`ollamaHost` in `dashboard.json`, `omarchy-shell infomarchy setOllamaHost` / `getOllamaHost`), else `OLLAMA_HOST`, else `http://127.0.0.1:11434`. Topic refinement still requires loopback unless `INFOMARCHY_ALLOW_REMOTE_OLLAMA=1`. A loopback port that is an SSH tunnel is treated as local.

**CONTAINERS.** Lower-right card lists Docker (or Podman) containers with a per-row on/off toggle. Start and stop go through `container-control.ts`, which checks a live `ps -a` inventory and passes the name as its own argv element. Compose services show as short labels. At most eight rows. The snapshot keeps id, name, label, service, project, image, state, running, and health. Compose working_dir, env files, commands, mounts, and ports are dropped. Hide or reorder it from the module strip like the other right-column cards. Skip collection with `INFOMARCHY_SKIP_CONTAINERS=1`.

**MEDIA CONTROLS.** Last right-column card. Live MPRIS (`Quickshell.Services.Mpris`): title, artist, album, player identity, PREV / PLAY or PAUSE / NEXT. Prefers a playing player over `playerctld`. No album art fetch. Stream privacy leaves those fields in the clear. Not on Web Mode. Hide or reorder it from the module strip like the other right-column cards.

**Web Mode.** A live browser version of the desk for your phone or another computer, with LAN HTTP, guided private HTTPS through Tailscale, or Manual HTTPS using an existing certificate. See [Web Mode](#web-mode) for behavior and privacy, and [Set up Web Mode](#set-up-web-mode) for all three setup paths.

**Grok weekly meter.** The collector reads the same billing route Grok `/usage` uses (`GET https://cli-chat-proxy.grok.com/v1/billing?format=credits` with the local CLI login), at most every 60 seconds, and caches it in `$XDG_STATE_HOME/infomarchy/grok-billing.json`. Wallpaper and overlay share that file and serialize requests with `flock`. Failed attempts also back off for 60 seconds. The overlay no longer skips the fetch. If that fetch is down it uses the latest `billing: fetched credits config` line in `~/.grok/logs/unified.jsonl`, then `$XDG_STATE_HOME/infomarchy/grok-limits.json`. Local session tokens still feed today/lifetime totals. No 5-hour Grok window is invented.

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

**SUPER+SHIFT+I** hides WAN, LAN, Wi-Fi SSID, `user@host`, GitHub login, `/home/<user>` mounts, and window previews. One press turns it on. Three presses within two seconds turn it off (the chip shows 1/3, then 2/3). Overlay ignores key-repeat so holding the chord cannot unmask. `omarchy-shell infomarchy setPrivacy false` still clears it in one shot. Recent-task prompts keep the first four words and mask the rest, including the inspect drawer. COPY EXCERPT still copies the full text. OSS project names, repos, and session topics stay. It persists in `dashboard.json`. The module strip shows **PRIVACY ON** in yellow while it is active. Web Mode follows this persisted desktop setting; its privacy status cannot be changed in the browser. Missing or invalid settings default to privacy on.

## Web Mode

Web Mode makes the Infomarchy desk available in a browser on your phone, tablet, or another computer. It runs with the desktop plugin, so the computer and Omarchy shell must stay running. Open **SETTINGS** from the desk's module strip to manage access.

The page follows the live Omarchy theme and wallpaper. Wide screens use two columns; narrow screens stack cards and offer **UP/DOWN** ordering. Module chips show or hide sections, and zoom is remembered for the current browser tab. Web section visibility and narrow-screen order are independent of the desktop layout but shared by web viewers. A successful refresh updates the page and theme every five seconds while preserving scroll position.

Web Mode displays sessions, recent tasks, activity, usage, local AI status, machine telemetry, and containers. USAGE includes per-model meters and **TOKENS · 7 days**, with unavailable token counts omitted. MEDIA CONTROLS and the $ VALUE chart are absent. Browser controls change presentation; desktop actions such as focusing sessions, loading models, and starting containers remain on the desktop.

### Access and viewer credentials

| Mode | Reachability | Transport | Default port |
| --- | --- | --- | --- |
| **LAN HTTP** | Trusted local IPv4 network; loopback/RFC1918 sources or explicitly allowed CIDRs | Dashboard data and viewer credentials travel unencrypted | 8787 |
| **PRIVATE HTTPS** | Connected Tailscale devices permitted by your tailnet policy | HTTPS through Tailscale Serve to a loopback backend | 8788 |
| **MANUAL HTTPS** | A configured private IPv4 interface or loopback, with the source allow list | Direct HTTPS using your existing certificate and private key | 8789 |

The modes are mutually exclusive. Selecting a different mode turns WEB off; enable it again after reviewing the new setup. Private HTTPS supports viewing away from home through Tailscale. Public internet exposure and Funnel are outside the supported setup.

Each viewer link contains a bearer token: someone with the link and network access can use it. **COPY URL** and **SHOW QR** deliberately reveal the selected token's address only after the listener is ready. Routine startup and status checks do not print token links. Keep links and QR images out of public screenshots, logs, commits, and chat. Tokens are individually revocable; turning WEB off stops access but keeps them for the next start.

### Privacy follows the desktop

The browser shows **PRIVACY ON/OFF · controlled on desktop**. Use the desktop privacy chip or **SUPER+SHIFT+I** to change it: one press enables privacy; three presses within two seconds disable it. Missing, unreadable, or malformed settings default to privacy on.

With privacy on, the server omits WAN/LAN addresses, Wi-Fi SSID, and user/host identity, shortens home mounts, and sends recent prompts only through their first four words plus the mask. Full values are absent from the HTML and JSON, including hidden elements. Session topics, project names, and prompts of four words or fewer stay visible. GitHub login and media remain excluded at either setting. The JSON view also excludes desktop action arguments, session working directories, previews, and extra provider fields.

Turning desktop privacy off lets connected viewers receive the permitted full values. Changes apply to subsequent responses, normally at the next successful five-second refresh; previously received or saved data cannot be retracted, and a disconnected page can retain its old content. Privacy does not encrypt LAN HTTP traffic. Desktop source data and full-text **COPY EXCERPT** are preserved.

## Set up Web Mode

Install and enable Infomarchy first using [Install](#install). Open the desk with **SUPER+D**, then **SETTINGS**. Choose the desktop privacy setting you want before sharing a viewer link.

Web helpers require Bun, `flock` (util-linux) and `timeout` (coreutils). **SHOW QR** uses `qrencode`; **COPY URL** uses `wl-copy` from `wl-clipboard`. On Omarchy/Arch, install the optional viewer tools with `sudo pacman -S --needed qrencode wl-clipboard`. Tailscale process cleanup requires Python 3; the optional CA recipe requires OpenSSL, and its download helper uses Python 3.

The fork also retains an experimental settings bar widget. It needs more polish and is excluded from the upstream Web Mode contribution; use the dashboard SETTINGS for setup. On the tested Omarchy version, `omarchy bar put` reported success without adding its layout entry, so that command is not yet a reliable setup path for this combined service/overlay/widget plugin.

### LAN HTTP: on your trusted local network

1. Connect the desktop and viewing device to a local network you control and trust. Guest Wi-Fi or client isolation can prevent devices from reaching one another.
2. Select **LAN HTTP** in settings. Click **WEB OFF** to start the listener and wait for **WEB ON**.
3. If your desktop firewall blocks incoming connections, allow TCP port **8787** from your actual trusted subnet. Infomarchy does not edit firewall rules. For example, if you use UFW and your subnet is `192.168.1.0/24`, run:

   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 8787 proto tcp
   ```

   Substitute your own subnet; do not use a broad internet-facing rule or router port forwarding. The firewall and Infomarchy's source allow list are separate checks. Loopback and RFC1918 private IPv4 sources are allowed by default. Add another CIDR in settings only when you intend to allow that network, then restart WEB. The Tailscale CGNAT range is not allowed by default, and an allowed source range is not proof of identity.
4. Follow [Open the page and manage viewers](#open-the-page-and-manage-viewers). The address is HTTP, so a browser may label the connection insecure; this mode does not provide TLS.

If the page cannot connect, confirm **WEB ON**, the current copied address, the desktop firewall, and Wi-Fi isolation. If access is denied, check the viewer's source network against the allow list and use a current, unrevoked viewer link.

### Private HTTPS: through Tailscale

1. **Install and connect Tailscale on the desktop.** On Omarchy versions that ship it, the built-in installer can be run with:

   ```bash
   omarchy-install-service-tailscale
   ```

   Follow its sign-in prompts. The installed Omarchy script starts the service, grants your local user Tailscale operator access, and adds a Tailscale admin-console web app and bar integration. If that installer is unavailable, use the [official Tailscale installation guide](https://tailscale.com/docs/install). Infomarchy detects Tailscale but does not install it or sign in for you.
2. **Enable the tailnet prerequisites.** In the Tailscale admin console's **DNS** page, enable **MagicDNS**, then enable **HTTPS Certificates**. Review the certificate-name disclosure shown there: certificate hostnames appear in the public Certificate Transparency ledger. See [Tailscale's HTTPS setup](https://tailscale.com/docs/how-to/set-up-https-certificates). Infomarchy uses Serve to manage HTTPS; you do not need to create certificate files yourself.
3. **Connect the viewing device.** Install the Tailscale app on your phone or other device, sign in to the intended tailnet, and connect it. The Tailscale web app's device-enrollment QR flow can help with phone setup. Complete any device approval and ensure tailnet policy permits this device to reach the desktop on TCP **8788**.
4. **Configure Infomarchy.** Select **PRIVATE HTTPS**. **CHECK PREREQUISITES** inspects the installed CLI, connection, DNS name, and existing Serve configuration. Follow any message it displays, then click **CONFIGURE & ENABLE**. Wait for **STARTING…** to become **WEB ON**. The first real setup attempt may discover a missing certificate or permission prerequisite that the inspection could not confirm.
5. **Recover directly if setup fails.** Read the message beside **WEB FAILED**, fix the reported prerequisite, and click **RETRY SETUP**. For example, if HTTPS certificates were disabled, enable them in the admin console and retry. **CHECK PREREQUISITES** only checks; it does not restart failed setup. There is no need to flip WEB off and on.
6. **Open the page** using the selected viewer's **COPY URL** or **SHOW QR**, as described below. Keep Tailscale connected on both devices. Use the copied HTTPS hostname and port, including the viewer credential; a bare hostname or IP address is not the dashboard link.

Infomarchy owns a foreground Serve mapping on **8788**, forwarding to its backend on **127.0.0.1:8787**. There is no need to open backend port 8787 on the LAN for this mode or manually create a background Serve mapping. If 8788 already belongs to another Serve or Funnel mapping, setup refuses to overwrite it. Resolve that specific conflict yourself; unrelated services are preserved. Turning WEB off, stopping the listener, or removing the plugin removes its owned mapping while leaving Tailscale and unrelated services running.

If setup reports local permissions, make sure the user running Omarchy is allowed to manage Serve; the Omarchy installer configures operator access. If it reports a missing/stopped/signed-out client or an unsupported CLI, correct that condition and retry. For more detail, **SETUP GUIDE** opens [Tailscale Serve documentation](https://tailscale.com/docs/features/tailscale-serve). Failed HTTPS setup never falls back to LAN HTTP or public access.

### Manual HTTPS: bring an existing certificate

This expert option uses certificate files you maintain. Starting without a CA? Follow [Private LAN HTTPS without DNS or Tailscale](#private-lan-https-without-dns-or-tailscale) below. Infomarchy binds the HTTPS listener and checks the certificate; you manage issuance, installation, DNS, client trust and renewal. The plugin does not create a CA, obtain certificates, change trust stores, or change DNS/firewall rules.

1. **Choose the hostname or private IPv4 address and network.** To avoid DNS, enter the desktop’s private IPv4 address as both **HOSTNAME / IPv4** and **BIND IPv4**, and use a certificate with that exact IP SAN. Otherwise, arrange for that hostname to resolve to your desktop's private LAN/VPN IPv4 address on each viewing device. Use that specific interface address for **BIND IPv4**. The safe default is `127.0.0.1`, which permits local viewing only. Wildcard and public bind addresses are refused. `infomarchy.localhost` with loopback is useful for local testing without LAN DNS changes. Ports must be 1024–65535; the default is **8789**.
2. **Prepare the certificate files.** Use a PEM certificate chain with the server/leaf certificate first, followed by its intermediates, and an unencrypted PEM private key that matches the leaf. A hostname must be covered by DNS subject alternative names; a literal address must match an IP subject alternative name (a DNS SAN containing IP text does not count). The files and their parent directories must be readable by the desktop user and protected against other users writing them. Use actual absolute paths without symlinks. The key must be owned by the desktop user or root and have mode **0600** or **0400**; Infomarchy does not elevate privileges to read it. An existing certificate's signed hostname coverage cannot be changed by entering another hostname here.
3. **Obtain its SHA-256 fingerprint.** For example:

   ```bash
   openssl x509 -in /absolute/path/to/server-chain.pem -noout -fingerprint -sha256
   ```

   Enter the hex fingerprint after the `=` sign, with or without colons. This identifies the exact leaf certificate, not its public key alone. Confirm it is the certificate you intend to serve.
4. **Configure the desk.** Select **MANUAL HTTPS**, fill in hostname, bind address, port, certificate-chain path, private-key path and fingerprint, then **SAVE CERTIFICATE SETTINGS**. Saving changes turns Manual HTTPS off. After saving finishes, **CHECK CERTIFICATE** verifies file safety, the fingerprint, validity dates, SAN hostname/IP identity, matching key and supplied chain signatures. It does not change files, install trust, or start a listener. Click **CONFIGURE & ENABLE**, wait for **WEB ON**, then use **COPY URL** or **SHOW QR**. Startup checks the files again; a failure offers **RETRY SETUP** and never falls back to HTTP.
5. **Set up viewing clients.** A certificate from a CA already trusted by that browser requires no additional CA installation. For a private CA or self-signed certificate, configure trust deliberately on each client. The fingerprint entered on the desk does not install browser trust. Keep the existing source allow list and any firewall rules limited to your trusted networks; VPN ranges outside loopback/RFC1918 need an explicit allowed CIDR. Tokens and desktop-owned privacy work exactly as in the other modes.

If the desktop’s IP changes, update the address and use a certificate covering the new IP, including its new fingerprint. Reserve the LAN address in DHCP for repeat use. `.localhost` names always refer to the viewing device itself, so they cannot be used to reach the desktop from a phone.

6. **Handle renewal.** Install the renewed certificate/key and update the leaf fingerprint, then save and re-enable HTTPS. Certificate files are loaded at startup rather than automatically replaced in a running listener. Expiry stops disclosure and the listener shuts down within 30 seconds. Client trust and certificate-chain validation are still the client's responsibility.

For background, see [Bun's TLS support](https://bun.sh/guides/http/tls) and [Mozilla's explanation of browser certificate trust](https://support.mozilla.org/en-US/kb/secure-website-certificate).

### Private LAN HTTPS without DNS or Tailscale

You can create your own CA and a certificate for the desktop's private IPv4 address using OpenSSL, then supply those files to Manual HTTPS. This is an operator-run setup; Infomarchy does not issue or renew certificates. The desktop and phone must be on a reachable trusted LAN. Reserve the desktop's address in DHCP if possible. These commands require Bash and OpenSSL; the optional download helper requires Python 3.

**Create the files.** Replace `192.168.1.50` with the desktop's actual private IPv4 address (`ip -4 addr` shows interface addresses). Run this block once in a terminal. It creates a new directory and refuses to overwrite an existing setup. The CA lasts one year; the server certificate lasts 90 days. Both private keys remain protected by filesystem permissions; keep the CA key private and securely backed up, since it can sign certificates trusted by your clients.

```bash
(
set -eu
umask 077
infomarchy_ip=192.168.1.50
infomarchy_pki="${XDG_STATE_HOME:-$HOME/.local/state}/infomarchy/pki/private-lan"
mkdir -p "$(dirname "$infomarchy_pki")"
mkdir -m 700 "$infomarchy_pki"
cd "$infomarchy_pki"

openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout ca.key -out ca.crt -days 365 -subj '/CN=Infomarchy private LAN CA' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext "nameConstraints=critical,permitted;IP:$infomarchy_ip/255.255.255.255,permitted;DNS:infomarchy.invalid"
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
  -keyout server.key -out server.csr -subj '/CN=Infomarchy LAN dashboard'
cat > server.ext <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=IP:$infomarchy_ip
EOF
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.pem -days 90 -extfile server.ext
cat server.pem ca.crt > server-chain.pem
openssl verify -CAfile ca.crt -verify_ip "$infomarchy_ip" server.pem
openssl x509 -in server.pem -noout -fingerprint -sha256
pwd
)
```

The CA's IP constraint permits the chosen address; its DNS constraint permits only `infomarchy.invalid` and subdomains. The leaf contains only the chosen IP SAN. See [OpenSSL's extension syntax](https://docs.openssl.org/master/man5/x509v3_config/). Keep this CA dedicated to this setup. Do not share `ca.key` or `server.key`, or serve the certificate directory over HTTP.

**Configure Manual HTTPS.** Use your desktop IP for both **HOSTNAME / IPv4** and **BIND IPv4**, port **8789**, and the absolute paths to `server-chain.pem` and `server.key` in the directory printed above. Enter the **server certificate** fingerprint printed by OpenSSL. Save, check the certificate, then enable WEB.

**Allow incoming connections.** With UFW, the following example permits only one phone to reach the listener. Substitute your Wi-Fi interface, phone IP and desktop IP:

```bash
sudo ufw allow in on wlo1 proto tcp from 192.168.1.60 to 192.168.1.50 port 8789 comment infomarchy-manual
```

Use equivalent scoped rules for other firewalls. A successful request from the desktop itself does not test incoming firewall access. Do not configure router port forwarding. Guest Wi-Fi/client isolation may still prevent access.

**Install the public CA on the phone.** Transfer only `ca.crt` by USB or another trusted transfer method. On Android, open Settings and find **Encryption & credentials → Install a certificate → CA certificate**, then select the file. Menu names vary by device; see [Google's certificate instructions](https://support.google.com/pixelphone/answer/2844832). Install it as a CA certificate, not a Wi-Fi or client certificate. Other viewing devices need their own browser/OS trust setup. The dashboard fingerprint does not install client trust.

For a temporary LAN download instead of USB, copy only the public CA into a new, separate directory and serve that directory in a foreground terminal:

```bash
infomarchy_public=$(mktemp -d)
cp "${XDG_STATE_HOME:-$HOME/.local/state}/infomarchy/pki/private-lan/ca.crt" "$infomarchy_public/infomarchy-ca.crt"
python3 -m http.server 8790 --bind 192.168.1.50 --directory "$infomarchy_public"
```

Substitute the desktop IP. Temporarily allow TCP **8790** with the same phone/interface/address restriction as 8789, then download `http://192.168.1.50:8790/infomarchy-ca.crt` on the phone. Before trusting a CA transferred over HTTP, compare its SHA-256 fingerprint in the phone's certificate details with `openssl x509 -in /absolute/path/to/ca.crt -noout -fingerprint -sha256` on the desktop; use USB if the phone cannot show it. This CA fingerprint is separate from the server fingerprint entered in Infomarchy.

After transferring, press **Ctrl+C**, remove the temporary directory with `rm -r -- "$infomarchy_public"`, and remove the download firewall rule:

```bash
sudo ufw delete allow in on wlo1 proto tcp from 192.168.1.60 to 192.168.1.50 port 8790
```

**Open the dashboard.** Once the CA is installed and WEB is on, use **SHOW QR** on the desktop and open the result in Chrome on Android. The CA download address is not the dashboard address. A long timeout usually calls for checking the address, listener, firewall and Wi-Fi isolation; a certificate error calls for checking CA trust, IP SAN, dates and the device clock. Do not bypass certificate errors.

**Maintain or retire the setup.** Renew the leaf before 90 days, signing a new CSR with the protected CA and the same IP SAN, then update the server fingerprint and restart Manual HTTPS. Do not rerun the initial block over existing files. An IP change also requires a new CA with the matching constraint in this recipe, a new leaf and client CA installation. Replace the CA before its expiry. When retiring this setup or switching back to Tailscale, stop the download helper, remove its firewall rule and the matching 8789 rule, and remove this CA from each client's user trust store. Switching modes turns WEB off; enable it again in the selected mode. When returning to Tailscale, reconnect both devices to your tailnet and use that mode’s **COPY URL** or **SHOW QR**; the Manual HTTPS IP address is a different endpoint. Viewer tokens survive the switch.

### Open the page and manage viewers

Once settings shows **WEB ON**, select a token in **TOKENS**, then use **COPY URL** to open it in a browser or **SHOW QR** to scan it on your phone. The Infomarchy QR opens the authenticated dashboard; it does not install Tailscale or authorize a device. This is separate from Tailscale's enrollment QR. Hide the QR when finished; closing settings or changing tokens clears it too.

For independent revocation, enter a descriptive label and click **ADD** for each viewer/device, then select that token before copying or showing its QR. Labels help you remember the intended viewer; the link itself is the credential and is not bound to that device. **REVOKE** invalidates that token for subsequent requests. Add a replacement before revoking the last token. Existing pages may retain already displayed data, but their next authenticated request will fail.

You can also deliberately copy the default viewer's address from the desktop without printing it:

```bash
omarchy-shell infomarchy copyWebUrl
```

To stop sharing, turn **WEB ON** off. Tokens survive stopping, restarting the shell, and switching modes. After changing modes, copy a fresh address because the hostname/protocol changes even though the token remains valid.

Settings persist in `$XDG_STATE_HOME/infomarchy/` (normally `~/.local/state/infomarchy/`): `dashboard.json` holds desktop privacy, web layout/access preferences and Manual HTTPS file references/fingerprint, `web.json` holds private viewer credentials with mode 0600, and `web-status.json` holds noncredential runtime status. Preference changes and viewer-token updates are serialized so overlapping edits preserve desktop privacy and token revocation. Empty `dashboard.lock` and `web-config.lock` files also remain in the state directory. A failed desktop settings save displays an error and reloads the saved settings; retry the change once the problem is resolved. Do not publish credential files or hand-edit them to recover a failed setup; use the reported guidance and **RETRY SETUP**.

## Remove

```bash
omarchy plugin remove techluddite.luddite-infomarchy --yes
omarchy restart shell
```

State under `$XDG_STATE_HOME/infomarchy/` (`dashboard.json`, `github-activity.json`, `grok-billing.json`, `grok-limits.json`, `web.json`, `web-status.json`, `web-snapshot.json`, collector baselines) is left in place. A running Web Mode listener and its owned foreground Tailscale Serve mapping stop with the plugin. Tailscale, its installation/login, unrelated Serve mappings, manually configured firewall rules, your Manual HTTPS certificate/key files and any client CA trust you installed remain. Toggle WEB off first if you want dashboard access stopped before removal.

## Contributors

With thanks to everyone who helped build Infomarchy and this fork:

- [Fred Nix](https://github.com/nixfred) — creator of the original Infomarchy.
- Claude — AI development assistance.
- Grok — AI development assistance.
- [TechLuddite](https://github.com/TechLuddite) — maintainer and contributor to this fork.

## License

[MIT](LICENSE). Copyright (c) 2026 Fred Nix.
