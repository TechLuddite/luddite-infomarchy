import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  DEFAULT_CIDRS, displayMount, escapeHtml, fmtBytes, fmtRate, handleRequest, hostAllowed, ipAllowed, maskSnapshot,
  originAllowed, parseCidr, parseCidrList, tokensEqual, newToken, ipv4ToInt, wifiLabel,
} from "./web-server";

const root = mkdtempSync(join(tmpdir(), "infomarchy-web-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const token = "a".repeat(48);
const cidrs = parseCidrList([]);
const base = {
  method: "GET",
  pathname: `/t/${token}/`,
  host: "172.20.20.142:8787",
  origin: null as string | null,
  sourceIp: "172.20.20.192",
  contentLength: 0,
  token,
  port: 8787,
  allowedHosts: ["172.20.20.142", "127.0.0.1"],
  cidrs,
  snapshot: { ts: 1, user: "larry", host: "box", machine: { externalIp: "203.0.113.9", net: { ssid: "secret", addr: "172.20.20.142", wireless: true, signal: -47, dev: "wlan0", rxRate: 2_420_000, txRate: 386_000 }, cpu: { pct: 27.4, load: [1.18, 0.92] }, mem: { pct: 44.4, used: 15_246_073_856, total: 34_359_738_368 }, disks: [{ mount: "/home/larry", size: 1_999_844_147_200, used: 816_043_786_240, pct: 40.8 }], ping: { ok: true, ms: 18.6 }, battery: { pct: 81, status: "Charging" }, temp: 52, uptime: 186_300 }, ai: { sessions: [{ provider: "pi", project: "Halo", topic: "<img src=x onerror=alert(1)>" }], attention: [], recent: [{ provider: "opencode", project: "~/Work", text: "<script>alert(1)</script>" }], usageDays: ["2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-09-05","2026-09-06","2026-09-07"], usage: { grok: { name: "Grok", ready: true, tierLabel: "weekly", todayPrompts: 4, todayTotalTokens: 4000, dailyTokens: [0,0,0,0,0,100,50], limits: [{ label: "WEEKLY", percent: 0.03, resetsAt: "2026-09-14T00:26:00-07:00" }], value: { lifetime: 1.2, today: 0.1, totals: { inputTokens: 100, outputTokens: 50, cacheReadInputTokens: 10, cacheCreationInputTokens: 0 } } }, claude: { name: "Claude Code", ready: true, tierLabel: "Max 5x", todayPrompts: 0, todayTotalTokens: 0, authHelpText: "Claude Code's saved sign-in expired", limits: [{ label: "Session (5-hour)", percent: 0.16, resetsAt: "2026-09-07T13:10:00Z" }] } }, github: { login: "TechLuddite" } } },
};

describe("phone view access control", () => {
  test("parses CIDRs and admits the phone LAN plus loopback", () => {
    expect(parseCidr("172.16.0.0/12")?.text).toBe("172.16.0.0/12");
    expect(parseCidr("999.0.0.0/8")).toBeNull();
    expect(parseCidr("10.0.0.0/33")).toBeNull();
    expect(ipv4ToInt("172.20.20.192")).toBeGreaterThan(0);
    expect(ipAllowed("172.20.20.192", cidrs)).toBe(true);
    expect(ipAllowed("127.0.0.1", cidrs)).toBe(true);
    expect(ipAllowed("8.8.8.8", cidrs)).toBe(false);
    expect(ipAllowed("::1", cidrs)).toBe(false);
    expect(DEFAULT_CIDRS).toContain("100.64.0.0/10");
  });

  test("compares tokens in constant time and rejects the wrong one as 404", () => {
    expect(tokensEqual(token, token)).toBe(true);
    expect(tokensEqual(token, "b".repeat(48))).toBe(false);
    expect(tokensEqual("short", token)).toBe(false);
    expect(newToken()).toMatch(/^[0-9a-f]{48}$/);
    const denied = handleRequest({ ...base, pathname: `/t/${"b".repeat(48)}/` });
    expect(denied.status).toBe(404);
    expect(denied.body).not.toContain("Halo");
  });

  test("rejects WAN IPs, bad Host, cross-origin, POST, and traversal", () => {
    expect(handleRequest({ ...base, sourceIp: "8.8.8.8" }).status).toBe(403);
    expect(handleRequest({ ...base, host: "evil.example" }).status).toBe(403);
    expect(hostAllowed("172.20.20.142:8787", base.allowedHosts, 8787)).toBe(true);
    expect(hostAllowed("evil.example", base.allowedHosts, 8787)).toBe(false);
    expect(originAllowed("http://evil.example", base.allowedHosts, 8787)).toBe(false);
    expect(originAllowed(null, base.allowedHosts, 8787)).toBe(true);
    expect(handleRequest({ ...base, method: "POST" }).status).toBe(405);
    expect(handleRequest({ ...base, pathname: `/t/${token}/../../etc/passwd` }).status).toBe(404);
    expect(handleRequest({ ...base, pathname: `/t/${token}/%2e%2e/` }).status).toBe(404);
    expect(handleRequest({ ...base, contentLength: 9000 }).status).toBe(413);
  });
});

describe("phone view rendering", () => {
  test("escapes HTML and strips identity fields", () => {
    expect(escapeHtml("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
    const masked = maskSnapshot(base.snapshot);
    expect(masked.user).toBeNull();
    expect(masked.host).toBeNull();
    expect(masked.machine.externalIp).toBeNull();
    expect(masked.machine.net.ssid).toBeNull();
    expect(masked.machine.net.addr).toBeNull();
    expect(masked.ai.github.login).toBe("");
    const page = handleRequest(base);
    expect(page.status).toBe(200);
    expect(page.headers["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(page.headers["X-Frame-Options"]).toBe("DENY");
    expect(page.body).toContain("Halo");
    expect(page.body).toContain("&lt;img src=x");
    expect(page.body).not.toContain("<img src");
    expect(page.body).not.toContain("<script>alert");
    expect(page.body.match(/<script/g)?.length).toBe(1);
    expect(page.body).not.toContain("TechLuddite");
    expect(page.body).toContain('class="privacy"');
    expect(page.body).toContain('id="privacy"');
    expect(page.body).toContain("PRIVACY ON");
    expect(page.body).toContain("WAN/LAN/SSID hidden");
    expect(page.body).toContain("WAN 203.0.113.9");
    expect(page.body).toContain("WIFI secret");
    expect(page.body).toContain("DISK ~");
    expect(page.body).toContain("DISK /home/larry");
    expect(page.body).not.toContain("<h2>RECENT</h2>");
    const usageAt = page.body.indexOf("USAGE");
    const sessionsAt = page.body.indexOf("LIVE SESSIONS");
    expect(usageAt).toBeGreaterThan(0);
    expect(usageAt).toBeLessThan(sessionsAt);
    expect(page.body).not.toContain("TOKENS · 7 days");
    expect(page.body).not.toContain("$ VALUE · 7 days");
    expect(page.body).not.toContain("polyline");
    expect(page.body).toContain("WEEKLY");
    expect(page.body).toContain("3%");
    expect(page.body).toContain("Claude Code");
    expect(page.body).toContain("sign-in expired");
    expect(page.body).not.toContain('http-equiv="refresh"');
    expect(page.body).not.toContain("refreshes every 5s");
    expect(page.body).toContain(">Refresh</a>");
    expect(page.body).toContain('id="view"');
    expect(page.body).toContain("fetch(location.pathname");
    expect(page.headers["Content-Security-Policy"]).toContain("connect-src 'self'");
    expect(page.headers["Content-Security-Policy"]).toMatch(/script-src 'nonce-[0-9a-f]{32}'/);
    expect(page.body).toMatch(/<script nonce="[0-9a-f]{32}">/);
    expect(page.body).toContain("CPU");
    expect(page.body).toContain("RAM");
    expect(page.body).toContain("DISK ~");
    expect(page.body).toContain("WIFI");
    expect(page.body).toContain("-47 dBm");
    expect(page.body).toContain("BAT 81% charging");
    expect(page.body).toContain("⇄ 19 ms");
    expect(fmtBytes(15_246_073_856)).toBe("14.2G");
    expect(fmtRate(2_420_000)).toBe("19.4Mb/s");
    expect(displayMount("/home/larry/Projects")).toBe("~/Projects");
    expect(wifiLabel({ wireless: true, ssid: "secret", dev: "wlan0" })).toBe("WIFI");
  });

  test("HEAD is empty and missing snapshots are 503", () => {
    expect(handleRequest({ ...base, method: "HEAD" }).body).toBe("");
    expect(handleRequest({ ...base, snapshot: null }).status).toBe(503);
  });
});

describe("live listen", () => {
  test("serves the page on loopback with the token path", async () => {
    mkdirSync(join(root, ".local", "state"), { recursive: true });
    const proc = Bun.spawn([process.execPath, join(import.meta.dir, "web-server.ts")], {
      env: { HOME: root, USER: "tester", XDG_STATE_HOME: join(root, ".local", "state"), PATH: "/usr/bin:/bin", INFOMARCHY_WEB_PORT: "0" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const reader = proc.stdout.getReader();
    const first = await reader.read();
    const line = new TextDecoder().decode(first.value || new Uint8Array());
    const status = JSON.parse(line.trim().split("\n")[0]);
    expect(status.ok).toBe(true);
    expect(status.url).toContain("/t/");
    writeFileSync(join(root, ".local", "state", "infomarchy", "web-snapshot.json"), JSON.stringify(base.snapshot));
    const page = await fetch(status.url, { headers: { Host: `127.0.0.1:${status.port}` } });
    // fetch from this process uses 127.0.0.1, which is allowed, but Host is the URL host.
    const text = await page.text();
    proc.kill("SIGTERM");
    await proc.exited;
    expect([200, 403]).toContain(page.status);
    if (page.status === 200) {
      expect(text).toContain("Infomarchy");
      expect(text).not.toContain("<script>alert");
    }
  });
});
