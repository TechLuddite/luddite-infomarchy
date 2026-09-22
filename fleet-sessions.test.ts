import { describe, expect, test } from "bun:test";
import {
  emptyFleetSessionStore, fleetSessionRowFromLocal, fleetSessionsEnabled, fleetSessionsPayload,
  fleetSessionsRefreshDue, hostRefreshDue, mergeFleetSessions, normalizeSession, normalizeTmux,
  parseFleetSessionStoreText, parseSessions, probeCommand, refreshFleetSessions, remoteCollectorPath,
  sshArgs, FLEET_SESSIONS_REFRESH_MS, FLEET_SESSIONS_UNSUPPORTED_BACKOFF_MS,
} from "./fleet-sessions";
import type { FleetRunner } from "./fleet-remote";

const hosts = [{ label: "OVH", host: "ovh" }];
const okPayload = JSON.stringify({
  v: 1,
  sessions: [
    { provider: "claude", pid: 41, project: "ra-omarchy", busy: true, attention: "", attentionReason: "", uptimeSec: 90, stale: false, tmux: { session: "ridge", window: "1", pane: "0" } },
    { provider: "claude", pid: 42, project: "personal", busy: false, attention: "waiting", attentionReason: "Claude reports it is blocked on you", uptimeSec: 900, stale: false, tmux: { session: "personal", window: "0", pane: "0" } },
  ],
});
const runnerFor = (output: string): FleetRunner => async () => output;

describe("parseSessions", () => {
  test("reads a well-formed payload", () => {
    const result = parseSessions(okPayload);
    expect(result.status).toBe("ok");
    expect(result.sessions.map(s => s.project)).toEqual(["ra-omarchy", "personal"]);
    expect(result.sessions[1].attention).toBe("waiting");
    expect(result.sessions[0].tmux).toEqual({ session: "ridge", window: "1", pane: "0" });
  });

  test("a host with no bun or no collector reports unsupported, not an error", () => {
    expect(parseSessions("FLEET_SESSIONS_UNSUPPORTED\n").status).toBe("unsupported");
  });

  test("an empty read is an error — the runner collapses timeout and spawn failure into it", () => {
    expect(parseSessions("").status).toBe("error");
    expect(parseSessions("   \n ").status).toBe("error");
  });

  test("an older Infomarchy's framed snapshot parses but is not this shape, so: unsupported", () => {
    expect(parseSessions(JSON.stringify({ v: 1, type: "chunk", data: "{\"ai\":{}}" })).status).toBe("unsupported");
  });

  test("malformed JSON never throws", () => {
    expect(parseSessions("{not json").status).toBe("unsupported");
    expect(parseSessions("[]").status).toBe("unsupported");
    expect(parseSessions("null").status).toBe("unsupported");
  });

  test("caps the session list from a host that reports hundreds", () => {
    const many = { sessions: Array.from({ length: 400 }, (_, i) => ({ provider: "claude", pid: i + 1 })) };
    expect(parseSessions(JSON.stringify(many)).sessions.length).toBe(24);
  });

  test("drops rows that carry no provider", () => {
    const mixed = { sessions: [{ pid: 7 }, { provider: "codex", pid: 8 }, "nope", null] };
    expect(parseSessions(JSON.stringify(mixed)).sessions.map(s => s.provider)).toEqual(["codex"]);
  });
});

describe("normalizing what a remote claims", () => {
  test("an unknown attention state becomes no signal, never a surprise on the desk", () => {
    expect(normalizeSession({ provider: "claude", attention: "EXPLODING" })?.attention).toBe("");
    expect(normalizeSession({ provider: "claude", attention: "waiting" })?.attention).toBe("waiting");
  });

  test("a reason without a state is dropped — it would render as an unexplained glow", () => {
    expect(normalizeSession({ provider: "claude", attention: "", attentionReason: "pay attention to me" })?.attentionReason).toBe("");
  });

  test("control characters and newlines cannot reach the desk", () => {
    expect(normalizeSession({ provider: "claude", project: "one\nline\u0007two" })?.project).toBe("one line two");
  });

  test("clamps hostile numbers", () => {
    const row = normalizeSession({ provider: "claude", pid: -5, uptimeSec: Number.NEGATIVE_INFINITY });
    expect(row?.pid).toBe(0);
    expect(row?.uptimeSec).toBe(0);
  });

  test("tmux ids that are not plainly tmux names are dropped, since they become argv", () => {
    expect(normalizeTmux({ session: "ridge; rm -rf /", window: "0", pane: "0" })).toBeNull();
    expect(normalizeTmux({ session: "ridge", window: "$(touch /tmp/x)", pane: "0" })).toBeNull();
    expect(normalizeTmux({ session: "ridge", window: "1", pane: "0" })).toEqual({ session: "ridge", window: "1", pane: "0" });
  });

  test("a session without tmux survives — it is simply not clickable", () => {
    expect(normalizeSession({ provider: "claude", tmux: null })?.tmux).toBeNull();
  });
});

describe("the privacy boundary", () => {
  const local = {
    provider: "claude", pid: 2806247, project: "ra-omarchy", cwd: "~/projects/ra-omarchy",
    _cwd: "/home/ridgetop/projects/ra-omarchy", busy: true, attention: "waiting",
    attentionReason: "Claude reports it is blocked on you",
    attentionDetail: "Bash command: cat ~/.ssh/id_ed25519",
    window: { title: "ra-omarchy — write the secret plan" },
    name: "ridge", uptimeSec: 84760, stale: false,
    git: { branch: "feat/fleet-sessions", dirty: 3 },
    resources: { cpuPct: 12, rss: 900 },
    hosts: [{ kind: "tmux", session: "ridge", window: "1", pane: "0", label: "tmux ridge:1.0" }],
  };

  test("publishes only the fields the fleet card needs", () => {
    expect(Object.keys(fleetSessionRowFromLocal(local)!).sort())
      .toEqual(["attention", "attentionReason", "busy", "pid", "project", "provider", "stale", "tmux", "uptimeSec"]);
  });

  test("the window title, the attention detail, the path and git state never cross the wire", () => {
    const wire = fleetSessionsPayload([local]);
    expect(wire).not.toContain("secret plan");
    expect(wire).not.toContain("id_ed25519");
    expect(wire).not.toContain("/home/ridgetop");
    expect(wire).not.toContain("feat/fleet-sessions");
  });

  test("the project basename and the tmux address do cross, because the jump needs them", () => {
    const wire = JSON.parse(fleetSessionsPayload([local]));
    expect(wire.sessions[0].project).toBe("ra-omarchy");
    expect(wire.sessions[0].tmux).toEqual({ session: "ridge", window: "1", pane: "0" });
    expect(wire.sessions[0].attention).toBe("waiting");
  });

  test("a host with no sessions publishes an empty list, not an error", () => {
    expect(JSON.parse(fleetSessionsPayload([]))).toEqual({ v: 1, sessions: [] });
  });
});

describe("the probe command", () => {
  test("falls back to ~/.bun/bin/bun, which a non-interactive ssh does not have on PATH", () => {
    expect(probeCommand(remoteCollectorPath({}))).toContain('$HOME/.bun/bin/bun');
  });

  test("reports unsupported rather than failing when bun or the collector is missing", () => {
    const command = probeCommand(remoteCollectorPath({}));
    expect(command).toContain("FLEET_SESSIONS_UNSUPPORTED");
    expect(command).toContain("--fleet-sessions");
  });

  test("bounds the transfer", () => {
    expect(probeCommand(remoteCollectorPath({}))).toContain("head -c");
  });

  test("a configured remote path that is not a plain path is refused", () => {
    expect(remoteCollectorPath({ INFOMARCHY_FLEET_REMOTE_PATH: '"; touch /tmp/pwned; #' })).toBe(remoteCollectorPath({}));
  });

  test("ssh runs in batch mode, so an unknown host fails instead of prompting the wallpaper", () => {
    const args = sshArgs("ovh", remoteCollectorPath({}));
    expect(args).toContain("BatchMode=yes");
    expect(args[args.length - 2]).toBe("ovh");
  });
});

describe("refresh scheduling", () => {
  const at = (checkedAt: number, status: "ok" | "unsupported" | "error") =>
    ({ host: "ovh", status, sessions: [], checkedAt, latencyMs: 1 });

  test("a host never probed is due", () => {
    expect(hostRefreshDue(undefined, 1_000)).toBe(true);
  });

  test("an ok host refreshes on the normal interval", () => {
    expect(hostRefreshDue(at(1_000, "ok"), 1_000 + FLEET_SESSIONS_REFRESH_MS - 1)).toBe(false);
    expect(hostRefreshDue(at(1_000, "ok"), 1_000 + FLEET_SESSIONS_REFRESH_MS)).toBe(true);
  });

  test("an unsupported host backs off, so a plain ssh box is not probed every tick", () => {
    expect(hostRefreshDue(at(1_000, "unsupported"), 1_000 + FLEET_SESSIONS_REFRESH_MS)).toBe(false);
    expect(hostRefreshDue(at(1_000, "unsupported"), 1_000 + FLEET_SESSIONS_UNSUPPORTED_BACKOFF_MS)).toBe(true);
  });

  test("a clock that moved backwards re-probes rather than waiting forever", () => {
    expect(hostRefreshDue(at(9_000, "ok"), 1_000)).toBe(true);
  });

  test("the store is due when any one host is due", () => {
    const store = { checkedAt: 1_000, results: [at(1_000, "ok")] };
    expect(fleetSessionsRefreshDue(store, hosts, 1_000)).toBe(false);
    expect(fleetSessionsRefreshDue(store, [...hosts, { label: "b", host: "other" }], 1_000)).toBe(true);
  });

  test("a host not due keeps its previous result instead of being re-probed", async () => {
    let calls = 0;
    const runner: FleetRunner = async () => { calls++; return okPayload; };
    const store = { checkedAt: 1_000, results: [{ host: "ovh", status: "ok" as const, sessions: [], checkedAt: 1_000, latencyMs: 5 }] };
    const refreshed = await refreshFleetSessions(store, 1_500, hosts, runner);
    expect(calls).toBe(0);
    expect(refreshed.results[0].checkedAt).toBe(1_000);
  });
});

describe("refreshFleetSessions", () => {
  test("records sessions from a host that answers", async () => {
    const store = await refreshFleetSessions(emptyFleetSessionStore(), 5_000, hosts, runnerFor(okPayload));
    expect(store.results[0].status).toBe("ok");
    expect(store.results[0].sessions.length).toBe(2);
  });

  test("a runner that throws becomes an error row, never an exception", async () => {
    const runner: FleetRunner = async () => { throw new Error("ssh exploded"); };
    const store = await refreshFleetSessions(emptyFleetSessionStore(), 5_000, hosts, runner);
    expect(store.results[0].status).toBe("error");
    expect(store.results[0].sessions).toEqual([]);
  });

  test("no configured hosts means no probe at all", async () => {
    let calls = 0;
    const runner: FleetRunner = async () => { calls++; return okPayload; };
    expect((await refreshFleetSessions(emptyFleetSessionStore(), 1, [], runner)).results).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("the store on disk", () => {
  test("a corrupt or foreign file reads as empty rather than throwing", () => {
    expect(parseFleetSessionStoreText("{oh no")).toEqual(emptyFleetSessionStore());
    expect(parseFleetSessionStoreText(null)).toEqual(emptyFleetSessionStore());
    expect(parseFleetSessionStoreText("[1,2,3]")).toEqual(emptyFleetSessionStore());
  });

  test("an oversized file is refused", () => {
    expect(parseFleetSessionStoreText("x".repeat(600_000))).toEqual(emptyFleetSessionStore());
  });

  test("a status this version does not know reads as error", () => {
    const text = JSON.stringify({ checkedAt: 1, results: [{ host: "ovh", status: "quantum", sessions: [] }] });
    expect(parseFleetSessionStoreText(text).results[0].status).toBe("error");
  });

  test("round-trips a real store", () => {
    const store = { checkedAt: 10, results: [{ host: "ovh", status: "ok" as const, sessions: parseSessions(okPayload).sessions, checkedAt: 10, latencyMs: 700 }] };
    expect(parseFleetSessionStoreText(JSON.stringify(store))).toEqual(store);
  });
});

describe("merging onto the ps rows", () => {
  const rows = [{ label: "OVH", host: "ovh", ok: true, checkedAt: 1, providers: [{ provider: "claude", count: 2 }] }];
  const store = { checkedAt: 1, results: [{ host: "ovh", status: "ok" as const, sessions: parseSessions(okPayload).sessions, checkedAt: 1, latencyMs: 700 }] };

  test("adds sessions and a needs-you count to the matching host", () => {
    const merged = mergeFleetSessions(rows, store);
    expect(merged[0].sessions.length).toBe(2);
    expect(merged[0].needsYou).toBe(1);
    expect(merged[0].providers).toEqual(rows[0].providers);
  });

  test("a host the session probe could not answer keeps its ps row untouched", () => {
    const unsupported = { checkedAt: 1, results: [{ host: "ovh", status: "unsupported" as const, sessions: [], checkedAt: 1, latencyMs: 20 }] };
    expect(mergeFleetSessions(rows, unsupported)).toEqual(rows);
    expect(mergeFleetSessions(rows, emptyFleetSessionStore())).toEqual(rows);
  });

  test("a store naming a host that is no longer configured changes nothing", () => {
    const stale = { checkedAt: 1, results: [{ host: "gone", status: "ok" as const, sessions: parseSessions(okPayload).sessions, checkedAt: 1, latencyMs: 5 }] };
    expect(mergeFleetSessions(rows, stale)).toEqual(rows);
  });

  test("no fleet rows means nothing to merge onto", () => {
    expect(mergeFleetSessions([], store)).toEqual([]);
  });
});

describe("the off switch", () => {
  test("is on by default and off when asked", () => {
    expect(fleetSessionsEnabled({})).toBe(true);
    expect(fleetSessionsEnabled({ INFOMARCHY_SKIP_FLEET_SESSIONS: "1" })).toBe(false);
  });
});
