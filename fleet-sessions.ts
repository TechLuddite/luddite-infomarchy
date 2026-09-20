// Per-session detail for the fleet hosts fleet-remote.ts already probes.
//
// fleet-remote.ts answers "is anything running over there" from one bounded
// `ps` call: provider counts, nothing finer. That is the right floor, because
// it needs nothing on the far end but a shell. This module answers the next
// question — WHICH remote session is waiting on you, and where it lives — by
// asking the remote machine's own Infomarchy collector, which already knows.
//
// So the two layers differ in what they require, not in what they mean:
//
//   ps probe (fleet-remote)   any POSIX host with ssh        counts
//   session probe (here)      host running Infomarchy + bun  sessions
//
// A host that cannot answer the richer probe keeps its `ps` row exactly as it
// is today. That is the whole compatibility story: this never replaces the
// floor, it sits on top of it, and it disappears cleanly when unavailable.
//
// PRIVACY. This is the boundary where session data leaves a machine, so it
// carries less than a local card, not the same:
//   - project basename only, never a path
//   - the attention STATE and its canned reason, never the window title
//     that produced it, and never prompt or task text
//   - tmux session/window/pane names, because they are the address the jump
//     needs, and the operator typed them
// The remote side enforces this too (collector.ts --fleet-sessions builds the
// same bounded row), so a malicious or mismatched remote cannot widen it: this
// side re-validates and clamps everything it reads. Never trust the far end.
import { fleetHostsFromEnv, type FleetHostConfig, type FleetRunner } from "./fleet-remote";

export type FleetSessionRow = {
  provider: string;
  pid: number;
  project: string;
  busy: boolean;
  attention: string;
  attentionReason: string;
  uptimeSec: number;
  stale: boolean;
  tmux: { session: string; window: string; pane: string } | null;
};
export type FleetSessionHostResult = {
  host: string;
  // "ok" — the host answered with sessions.
  // "unsupported" — reachable, but no Infomarchy/bun over there. Not an error:
  //   the host keeps its ps row and we stop asking for a while.
  // "error" — unreachable or the probe failed. Same treatment, shorter backoff.
  status: "ok" | "unsupported" | "error";
  sessions: FleetSessionRow[];
  checkedAt: number;
  latencyMs: number;
};
export type FleetSessionStore = { checkedAt: number; results: FleetSessionHostResult[] };

export const FLEET_SESSIONS_REFRESH_MS = 30_000;
// A host that has no Infomarchy is not going to grow one in the next tick.
// Re-ask rarely, so an unconfigured fleet costs one probe every ten minutes
// rather than one every refresh.
export const FLEET_SESSIONS_UNSUPPORTED_BACKOFF_MS = 600_000;
export const FLEET_SESSIONS_SSH_TIMEOUT_MS = 6_000;
const MAX_SESSIONS_PER_HOST = 24;
const MAX_PROBE_BYTES = 131_072;
const STORE_MAX_BYTES = 524_288;
const MAX_TEXT = 120;

// Where the remote keeps its collector. The plugin install path is the same on
// every Omarchy box; INFOMARCHY_FLEET_REMOTE_PATH covers a non-standard one.
// It is shell-quoted into the probe, so it is validated like every other id.
const DEFAULT_REMOTE_COLLECTOR = "$HOME/.config/omarchy/plugins/nixfred.infomarchy/collector.ts";
const REMOTE_PATH_RE = /^[A-Za-z0-9_$@%+=:,.\/-]{1,512}$/;
// bun installs to ~/.bun/bin, which a non-interactive ssh does not have on
// PATH — the shell reads .bashrc only when interactive. Look in both places
// rather than requiring the operator to fix their remote shell profile.
const PROBE_PREAMBLE = 'B=$(command -v bun || echo "$HOME/.bun/bin/bun"); [ -x "$B" ] || { echo FLEET_SESSIONS_UNSUPPORTED; exit 0; }';

export function remoteCollectorPath(env: NodeJS.Dict<string> | NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.INFOMARCHY_FLEET_REMOTE_PATH || "").trim();
  return configured && REMOTE_PATH_RE.test(configured) ? configured : DEFAULT_REMOTE_COLLECTOR;
}

export function fleetSessionsEnabled(env: NodeJS.Dict<string> | NodeJS.ProcessEnv = process.env): boolean {
  return env.INFOMARCHY_SKIP_FLEET_SESSIONS !== "1";
}

export function probeCommand(collectorPath: string): string {
  return `${PROBE_PREAMBLE}; [ -f "${collectorPath}" ] || { echo FLEET_SESSIONS_UNSUPPORTED; exit 0; }; "$B" "${collectorPath}" --fleet-sessions 2>/dev/null | head -c ${MAX_PROBE_BYTES}`;
}

export function sshArgs(host: string, collectorPath: string): string[] {
  return [
    "ssh",
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=4",
    "-o", "ServerAliveInterval=4",
    "-o", "ServerAliveCountMax=1",
    host,
    probeCommand(collectorPath),
  ];
}

export function emptyFleetSessionStore(): FleetSessionStore {
  return { checkedAt: 0, results: [] };
}

function finite(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

// Text off the wire: one line, bounded, no control characters. The remote
// already redacts, but a snapshot this side renders must not depend on that.
function text(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

const TMUX_NAME_RE = /^[A-Za-z0-9_.:@%+=-]{1,64}$/;
// tmux ids become argv for the jump, so anything that is not plainly a tmux
// name is dropped rather than escaped. A row without tmux is still useful —
// it simply is not clickable.
export function normalizeTmux(raw: unknown): FleetSessionRow["tmux"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const session = text(source.session, 64);
  const window = text(source.window, 64);
  const pane = text(source.pane, 64);
  if (!session || !TMUX_NAME_RE.test(session)) return null;
  if (window && !TMUX_NAME_RE.test(window)) return null;
  if (pane && !TMUX_NAME_RE.test(pane)) return null;
  return { session, window, pane };
}

export function normalizeSession(raw: unknown): FleetSessionRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const provider = text(source.provider, 32);
  if (!provider) return null;
  // "waiting" and "done" are the only states the desk renders; anything else
  // from a newer or stranger remote becomes no signal rather than a surprise.
  const attentionRaw = text(source.attention, 16);
  const attention = attentionRaw === "waiting" || attentionRaw === "done" ? attentionRaw : "";
  return {
    provider,
    pid: Math.floor(finite(source.pid)),
    project: text(source.project, 64),
    busy: source.busy === true,
    attention,
    attentionReason: attention ? text(source.attentionReason) : "",
    uptimeSec: Math.floor(finite(source.uptimeSec)),
    stale: source.stale === true,
    tmux: normalizeTmux(source.tmux),
  };
}

export function parseSessions(output: string): { status: FleetSessionHostResult["status"]; sessions: FleetSessionRow[] } {
  const body = String(output || "").trim();
  if (!body) return { status: "error", sessions: [] };
  if (body.includes("FLEET_SESSIONS_UNSUPPORTED")) return { status: "unsupported", sessions: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return { status: "unsupported", sessions: [] }; }
  // An older Infomarchy that does not know --fleet-sessions prints its ordinary
  // framed snapshot, which parses but is not this shape. Shape, not exit code,
  // decides: no sessions array means the far end cannot answer this probe.
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as any).sessions))
    return { status: "unsupported", sessions: [] };
  const sessions = (parsed as any).sessions
    .slice(0, MAX_SESSIONS_PER_HOST)
    .map(normalizeSession)
    .filter((row: FleetSessionRow | null): row is FleetSessionRow => row !== null);
  return { status: "ok", sessions };
}

function normalizeHostResult(raw: unknown): FleetSessionHostResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const host = text(source.host, 253);
  if (!host) return null;
  const statusRaw = text(source.status, 16);
  const status: FleetSessionHostResult["status"] =
    statusRaw === "ok" || statusRaw === "unsupported" ? statusRaw : "error";
  const sessions = Array.isArray(source.sessions)
    ? source.sessions.slice(0, MAX_SESSIONS_PER_HOST).map(normalizeSession).filter((row): row is FleetSessionRow => row !== null)
    : [];
  return { host, status, sessions, checkedAt: finite(source.checkedAt), latencyMs: finite(source.latencyMs) };
}

// Same shape of trust as fleet-remote's store: the file on disk was written by
// a previous version of this module and is never assumed to match these types.
export function normalizeFleetSessionStore(raw: unknown): FleetSessionStore {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyFleetSessionStore();
  const source = raw as Record<string, unknown>;
  const results = Array.isArray(source.results)
    ? source.results.slice(0, 16).map(normalizeHostResult).filter((r): r is FleetSessionHostResult => r !== null)
    : [];
  return { checkedAt: finite(source.checkedAt), results };
}

export function parseFleetSessionStoreText(value: string | null | undefined): FleetSessionStore {
  if (typeof value !== "string" || !value || value.length > STORE_MAX_BYTES) return emptyFleetSessionStore();
  try { return normalizeFleetSessionStore(JSON.parse(value)); } catch { return emptyFleetSessionStore(); }
}

// Per host, not per store: an unsupported host is asked again every ten
// minutes while a working one refreshes every thirty seconds.
export function hostRefreshDue(previous: FleetSessionHostResult | undefined, now: number): boolean {
  if (!previous) return true;
  const last = previous.checkedAt || 0;
  if (!(last > 0) || last > now) return true;
  const interval = previous.status === "unsupported" ? FLEET_SESSIONS_UNSUPPORTED_BACKOFF_MS : FLEET_SESSIONS_REFRESH_MS;
  return now - last >= interval;
}

export function fleetSessionsRefreshDue(store: FleetSessionStore, hosts: FleetHostConfig[], now: number): boolean {
  return hosts.some(host => hostRefreshDue(store.results.find(result => result.host === host.host), now));
}

async function probeHost(config: FleetHostConfig, runner: FleetRunner, collectorPath: string, now: number): Promise<FleetSessionHostResult> {
  const started = Date.now();
  try {
    const output = await runner(sshArgs(config.host, collectorPath), FLEET_SESSIONS_SSH_TIMEOUT_MS);
    const { status, sessions } = parseSessions(output);
    return { host: config.host, status, sessions, checkedAt: now, latencyMs: Date.now() - started };
  } catch {
    return { host: config.host, status: "error", sessions: [], checkedAt: now, latencyMs: Date.now() - started };
  }
}

// Only hosts actually due are probed; the rest keep their previous result, so
// a host on unsupported backoff costs nothing at all on most ticks.
export async function refreshFleetSessions(
  store: FleetSessionStore,
  now: number,
  hosts: FleetHostConfig[],
  runner: FleetRunner,
  collectorPath = remoteCollectorPath(),
): Promise<FleetSessionStore> {
  if (!hosts.length) return { checkedAt: now, results: [] };
  const results = await Promise.all(hosts.map(async host => {
    const previous = store.results.find(result => result.host === host.host);
    if (!hostRefreshDue(previous, now)) return previous!;
    return probeHost(host, runner, collectorPath, now);
  }));
  return { checkedAt: now, results };
}

// Merged onto the rows fleet-remote already produces, by host. A row the
// session probe could not answer is returned untouched — that is the fallback,
// and it is why this cannot regress the merged feature.
export function mergeFleetSessions(rows: any[], store: FleetSessionStore): any[] {
  if (!Array.isArray(rows) || !rows.length) return Array.isArray(rows) ? rows : [];
  const byHost = new Map(store.results.map(result => [result.host, result]));
  return rows.map(row => {
    const result = byHost.get(String(row?.host || ""));
    if (!result || result.status !== "ok") return row;
    return {
      ...row,
      sessions: result.sessions,
      // The card needs this without walking the list to decide whether to glow.
      needsYou: result.sessions.filter(session => session.attention === "waiting").length,
    };
  });
}

export function fleetHostConfigs(env: NodeJS.Dict<string> | NodeJS.ProcessEnv = process.env): FleetHostConfig[] {
  return fleetHostsFromEnv(env);
}

// ---- the remote side ----
// What a host publishes about itself when asked. This is the ONLY place the
// wire shape is built, so the privacy boundary in this file's header is one
// function, not a rule spread across the collector. Everything a local card
// shows and this omits — window titles, prompt excerpts, cwd paths, git state,
// resource figures — is omitted here deliberately, not forgotten.
export function fleetSessionRowFromLocal(session: any): FleetSessionRow | null {
  if (!session || typeof session !== "object") return null;
  const tmuxHost = Array.isArray(session.hosts) ? session.hosts.find((host: any) => host?.kind === "tmux") : null;
  return normalizeSession({
    provider: session.provider,
    pid: session.pid,
    project: session.project,
    busy: session.busy === true,
    attention: session.attention,
    attentionReason: session.attentionReason,
    uptimeSec: session.uptimeSec,
    stale: session.stale === true,
    tmux: tmuxHost ? { session: tmuxHost.session, window: tmuxHost.window, pane: tmuxHost.pane } : null,
  });
}

export function fleetSessionsPayload(sessions: any[]): string {
  const rows = (Array.isArray(sessions) ? sessions : [])
    .map(fleetSessionRowFromLocal)
    .filter((row): row is FleetSessionRow => row !== null)
    .slice(0, MAX_SESSIONS_PER_HOST);
  return JSON.stringify({ v: 1, sessions: rows });
}
