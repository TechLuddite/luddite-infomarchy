#!/usr/bin/env bun
// LAN phone view: read-only HTML of the latest collector snapshot.
// Off until toggled. Token in the path, source IP allowlist, Host check,
// HTML-escaped fields, no mutating routes. Token never travels in argv.

import { networkInterfaces } from "os";
import { randomBytes, timingSafeEqual } from "crypto";
import { isIP } from "net";
import { join } from "path";
import { existsSync, unlinkSync } from "fs";
import { parseJsonBounded, readRegularFileLimited, writePrivateStateFile } from "./collector";

const HOME = process.env.HOME || "/root";
const XDG_STATE = process.env.XDG_STATE_HOME || join(HOME, ".local/state");
const STATE_DIR = join(XDG_STATE, "infomarchy");
const CONFIG_NAME = "web.json";
const SNAPSHOT_NAME = "web-snapshot.json";
const MAX_SNAPSHOT_BYTES = 960 * 1024;
const TOKEN_BYTES = 24;
const DEFAULT_PORT = 8787;
const MAX_REQUEST_BYTES = 8192;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

export const DEFAULT_CIDRS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "100.64.0.0/10",
];

export type Cidr = { network: number; mask: number; text: string };

export function ipv4ToInt(ip: string): number | null {
  const parts = String(ip || "").split(".");
  if (parts.length !== 4) return null;
  const n = parts.map(part => Number(part));
  if (n.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return ((n[0] << 24) >>> 0) + (n[1] << 16) + (n[2] << 8) + n[3];
}

export function parseCidr(text: string): Cidr | null {
  const raw = String(text || "").trim();
  const match = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);
  if (!match) return null;
  const network = ipv4ToInt(match[1]);
  const bits = Number(match[2]);
  if (network === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { network: network & mask, mask, text: match[1] + "/" + bits };
}

export function canonicalIp(value: string): string {
  return String(value || "").trim().replace(/^::ffff:/i, "");
}

export function ipInCidr(ip: string, cidr: Cidr): boolean {
  const n = ipv4ToInt(canonicalIp(ip));
  return n !== null && (n & cidr.mask) === cidr.network;
}

export function ipAllowed(ip: string, cidrs: Cidr[]): boolean {
  const host = canonicalIp(ip);
  if (isIP(host) !== 4) return false;
  return cidrs.some(cidr => ipInCidr(host, cidr));
}

export function parseCidrList(values: unknown): Cidr[] {
  const extra = Array.isArray(values) ? values : [];
  const out: Cidr[] = [];
  const seen = new Set<string>();
  for (const item of [...DEFAULT_CIDRS, ...extra]) {
    const cidr = parseCidr(String(item || ""));
    if (!cidr || seen.has(cidr.text)) continue;
    seen.add(cidr.text);
    out.push(cidr);
  }
  return out;
}

export function tokensEqual(got: string, expected: string): boolean {
  const a = Buffer.from(String(got || ""));
  const b = Buffer.from(String(expected || ""));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function escapeHtml(value: unknown, max = 400): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, max)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function localPrivateIPv4(): string[] {
  const found: string[] = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const addr of nets[name] || []) {
      if (addr.internal || addr.family !== "IPv4") continue;
      const ip = canonicalIp(addr.address);
      if (isIP(ip) === 4 && parseCidrList([]).some(cidr => cidr.text !== "127.0.0.0/8" && ipInCidr(ip, cidr))) {
        if (!found.includes(ip)) found.push(ip);
      }
    }
  }
  const def = found.find(ip => ip.startsWith("172.20.") || ip.startsWith("192.168.") || ip.startsWith("10.")) || found[0] || "";
  return def ? [def, ...found.filter(ip => ip !== def)] : found;
}

export function advertisedBind(preferred: string[]): string {
  return preferred[0] || "127.0.0.1";
}

export type WebConfig = {
  token: string;
  port: number;
  extraCidrs: string[];
};

export function validToken(value: unknown): string {
  const token = String(value || "");
  return /^[0-9a-f]{48}$/.test(token) ? token : "";
}

export function validPort(value: unknown): number {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 0;
}

export function loadConfig(): WebConfig | null {
  const raw = readRegularFileLimited(join(STATE_DIR, CONFIG_NAME), 4096);
  if (!raw) return null;
  const parsed = parseJsonBounded(raw, 4096, 8);
  if (!parsed || typeof parsed !== "object") return null;
  const token = validToken(parsed.token);
  const port = validPort(parsed.port) || DEFAULT_PORT;
  const extraCidrs = Array.isArray(parsed.extraCidrs)
    ? parsed.extraCidrs.map((item: unknown) => String(item)).filter((item: string) => !!parseCidr(item)).slice(0, 8)
    : [];
  if (!token) return null;
  return { token, port, extraCidrs };
}

export function saveConfig(config: WebConfig): boolean {
  return writePrivateStateFile(STATE_DIR, CONFIG_NAME, JSON.stringify({
    token: config.token,
    port: config.port,
    extraCidrs: config.extraCidrs,
  }) + "\n");
}

export function ensureConfig(extraCidrs: string[] = []): WebConfig {
  const existing = loadConfig();
  if (existing) {
    if (extraCidrs.length) {
      const merged = [...existing.extraCidrs];
      for (const item of extraCidrs) if (parseCidr(item) && !merged.includes(item)) merged.push(item);
      existing.extraCidrs = merged.slice(0, 8);
      saveConfig(existing);
    }
    return existing;
  }
  const created: WebConfig = { token: newToken(), port: DEFAULT_PORT, extraCidrs: extraCidrs.filter(item => !!parseCidr(item)).slice(0, 8) };
  saveConfig(created);
  return created;
}

export function maskSnapshot(snap: any): any {
  if (!snap || typeof snap !== "object") return {};
  const machine = snap.machine && typeof snap.machine === "object" ? { ...snap.machine } : {};
  const net = machine.net && typeof machine.net === "object" ? { ...machine.net } : {};
  net.ssid = null;
  net.addr = null;
  machine.net = net;
  machine.externalIp = null;
  const ai = snap.ai && typeof snap.ai === "object" ? { ...snap.ai } : {};
  const github = ai.github && typeof ai.github === "object" ? { ...ai.github, login: "" } : ai.github;
  ai.github = github;
  return { ...snap, user: null, host: null, machine, ai };
}

function take(list: unknown, n: number): any[] {
  return Array.isArray(list) ? list.slice(0, n) : [];
}

export function renderPage(snap: any, refreshPath: string): string {
  const ai = snap.ai || {};
  const machine = snap.machine || {};
  const sessions = take(ai.sessions, 12);
  const attention = take(ai.attention, 8);
  const recent = take(ai.recent, 40);
  const usage = ai.usage && typeof ai.usage === "object" ? ai.usage : {};
  const mem = machine.mem || {};
  const cpu = machine.cpu || {};
  const rows: string[] = [];
  rows.push(`<!doctype html><html lang="en"><head><meta charset="utf-8">`);
  rows.push(`<meta name="viewport" content="width=device-width,initial-scale=1">`);
  rows.push(`<meta http-equiv="refresh" content="5;url=${escapeHtml(refreshPath, 200)}">`);
  rows.push(`<title>Infomarchy</title><style>
:root { color-scheme: dark; }
body { margin: 0; font: 15px/1.4 ui-sans-serif, system-ui, sans-serif; background: #111; color: #ddd; }
main { max-width: 42rem; margin: 0 auto; padding: 12px; }
h1 { font-size: 1.1rem; margin: 0 0 8px; }
h2 { font-size: 0.8rem; letter-spacing: 0.08em; color: #8ad; margin: 18px 0 8px; }
.card { background: #1b1b1b; border: 1px solid #333; border-radius: 10px; padding: 10px 12px; margin: 0 0 8px; }
.meta { color: #888; font-size: 0.8rem; }
.prompt { color: #eee; }
.tag { display: inline-block; font-size: 0.7rem; letter-spacing: 0.04em; color: #8ad; }
</style></head><body><main>`);
  rows.push(`<h1>Infomarchy</h1><p class="meta">read-only · identity hidden · refreshes every 5s</p>`);

  rows.push(`<h2>NEXT ACTIONS</h2>`);
  if (!attention.length) rows.push(`<div class="card meta">none</div>`);
  for (const item of attention) {
    rows.push(`<div class="card"><span class="tag">${escapeHtml(item.provider, 32)}</span> ${escapeHtml(item.project, 80)}<div class="prompt">${escapeHtml(item.attentionReason || item.attention, 240)}</div></div>`);
  }

  rows.push(`<h2>LIVE SESSIONS</h2>`);
  if (!sessions.length) rows.push(`<div class="card meta">none</div>`);
  for (const item of sessions) {
    rows.push(`<div class="card"><span class="tag">${escapeHtml(item.provider, 32)}</span> ${escapeHtml(item.project || item.name, 80)}<div class="prompt">${escapeHtml(item.topic || "", 240)}</div><div class="meta">${escapeHtml(item.git?.branch ? "git " + item.git.branch : "", 80)}</div></div>`);
  }

  rows.push(`<h2>RECENT</h2>`);
  if (!recent.length) rows.push(`<div class="card meta">none</div>`);
  for (const item of recent) {
    rows.push(`<div class="card"><span class="tag">${escapeHtml(item.provider, 32)}</span> ${escapeHtml(item.project, 80)}<div class="prompt">${escapeHtml(item.text, 280)}</div></div>`);
  }

  const usageKeys = Object.keys(usage).slice(0, 8);
  rows.push(`<h2>USAGE</h2>`);
  if (!usageKeys.length) rows.push(`<div class="card meta">none</div>`);
  for (const key of usageKeys) {
    const row = usage[key] || {};
    rows.push(`<div class="card"><span class="tag">${escapeHtml(row.name || key, 40)}</span> <span class="meta">${escapeHtml(row.tierLabel, 40)} · ${escapeHtml(row.todayPrompts, 12)} prompts today</span></div>`);
  }

  const cpuPct = cpu.pct == null ? "—" : Math.round(Number(cpu.pct)) + "%";
  const ram = mem.used && mem.total ? Math.round(Number(mem.pct)) + "%" : "—";
  rows.push(`<h2>MACHINE</h2><div class="card">CPU ${escapeHtml(cpuPct, 16)} · RAM ${escapeHtml(ram, 16)}<div class="meta">WAN/LAN/SSID hidden on the phone view</div></div>`);
  rows.push(`</main></body></html>`);
  return rows.join("");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
};

function reply(status: number, body: string, type = "text/html; charset=utf-8"): { status: number; headers: Record<string, string>; body: string } {
  return { status, headers: { ...SECURITY_HEADERS, "Content-Type": type }, body };
}

export function hostAllowed(hostHeader: string, allowedHosts: string[], port: number): boolean {
  const raw = String(hostHeader || "").trim().toLowerCase();
  if (!raw || raw.length > 128 || /[\s/]/.test(raw)) return false;
  const host = raw.replace(/:\d+$/, "");
  if (!allowedHosts.includes(host)) return false;
  const portMatch = raw.match(/:(\d+)$/);
  if (portMatch && Number(portMatch[1]) !== port) return false;
  return true;
}

export function originAllowed(origin: string | null, allowedHosts: string[], port: number): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    if (url.username || url.password || url.search || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (!allowedHosts.includes(host)) return false;
    const originPort = url.port ? Number(url.port) : 80;
    return originPort === port || (originPort === 80 && port === 80);
  } catch {
    return false;
  }
}

export function handleRequest(input: {
  method: string;
  pathname: string;
  host: string;
  origin: string | null;
  sourceIp: string;
  contentLength: number;
  token: string;
  port: number;
  allowedHosts: string[];
  cidrs: Cidr[];
  snapshot: any | null;
}): { status: number; headers: Record<string, string>; body: string } {
  const method = String(input.method || "").toUpperCase();
  if (input.contentLength > MAX_REQUEST_BYTES) return reply(413, "too large");
  if (!ipAllowed(input.sourceIp, input.cidrs)) return reply(403, "forbidden");
  if (!hostAllowed(input.host, input.allowedHosts, input.port)) return reply(403, "forbidden");
  if (!originAllowed(input.origin, input.allowedHosts, input.port)) return reply(403, "forbidden");
  if (method !== "GET" && method !== "HEAD") return reply(405, "method not allowed");

  const path = String(input.pathname || "");
  if (path.length > 256 || path.includes("..") || path.includes("//") || path.includes("\\") || path.includes("%")) return reply(404, "not found");
  const match = path.match(/^\/t\/([0-9a-f]{48})\/(snapshot\.json)?$/);
  if (!match || !tokensEqual(match[1], input.token)) return reply(404, "not found");

  if (!input.snapshot) return reply(503, "collecting");
  const masked = maskSnapshot(input.snapshot);
  const pagePath = `/t/${input.token}/`;
  if (match[2] === "snapshot.json") {
    const body = JSON.stringify({ ts: masked.ts || 0, ai: { sessions: take(masked.ai?.sessions, 12), attention: take(masked.ai?.attention, 8), recent: take(masked.ai?.recent, 40) } });
    const result = reply(200, body, "application/json; charset=utf-8");
    if (method === "HEAD") result.body = "";
    return result;
  }
  const html = renderPage(masked, pagePath);
  const result = reply(200, html);
  if (method === "HEAD") result.body = "";
  return result;
}

export function loadSnapshot(): any | null {
  const raw = readRegularFileLimited(join(STATE_DIR, SNAPSHOT_NAME), MAX_SNAPSHOT_BYTES);
  if (!raw) return null;
  const parsed = parseJsonBounded(raw, MAX_SNAPSHOT_BYTES, 24);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function publicUrl(config: WebConfig, bind: string): string {
  return `http://${bind}:${config.port}/t/${config.token}/`;
}

export function publishSnapshot(snapshot: unknown): boolean {
  if (!loadConfig()) return false;
  try {
    return writePrivateStateFile(STATE_DIR, SNAPSHOT_NAME, JSON.stringify(snapshot));
  } catch {
    return false;
  }
}

export function disableWebFiles(): void {
  for (const name of [CONFIG_NAME, SNAPSHOT_NAME]) {
    try { if (existsSync(join(STATE_DIR, name))) unlinkSync(join(STATE_DIR, name)); } catch {}
  }
}

const hits = new Map<string, { window: number; count: number }>();
function rateOk(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.window >= RATE_WINDOW_MS) {
    hits.set(ip, { window: now, count: 1 });
    if (hits.size > 256) {
      for (const key of hits.keys()) {
        const item = hits.get(key);
        if (!item || now - item.window >= RATE_WINDOW_MS) hits.delete(key);
      }
    }
    return true;
  }
  row.count++;
  return row.count <= RATE_MAX;
}

async function serve() {
  const extra = process.argv.filter(arg => parseCidr(arg)).slice(0, 8);
  const config = ensureConfig(extra);
  const bind = advertisedBind(localPrivateIPv4());
  const cidrs = parseCidrList(config.extraCidrs);
  const allowedHosts = [...localPrivateIPv4(), "127.0.0.1"];
  const requestedPort = validPort(process.env.INFOMARCHY_WEB_PORT) || config.port;
  const server = Bun.serve({
    hostname: "0.0.0.0",
    port: requestedPort,
    maxRequestBodySize: MAX_REQUEST_BYTES,
    idleTimeout: 10,
    fetch(req, srv) {
      const sourceIp = canonicalIp(srv.requestIP(req)?.address || "");
      if (!rateOk(sourceIp)) return new Response("rate", { status: 429, headers: SECURITY_HEADERS });
      const url = new URL(req.url);
      const result = handleRequest({
        method: req.method,
        pathname: url.pathname.endsWith("/") || url.pathname.endsWith("snapshot.json") ? url.pathname : url.pathname + "/",
        host: req.headers.get("host") || "",
        origin: req.headers.get("origin"),
        sourceIp,
        contentLength: Number(req.headers.get("content-length") || 0),
        token: config.token,
        port: srv.port,
        allowedHosts,
        cidrs,
        snapshot: loadSnapshot(),
      });
      return new Response(result.body, { status: result.status, headers: result.headers });
    },
  });
  await Bun.write(Bun.stdout, JSON.stringify({ ok: true, url: publicUrl({ ...config, port: server.port }, bind), port: server.port, bind }) + "\n");
}

if (import.meta.main) {
  const cmd = process.argv[2] || "serve";
  if (cmd === "disable") {
    disableWebFiles();
    process.exit(0);
  }
  if (cmd === "url") {
    const config = loadConfig();
    const bind = advertisedBind(localPrivateIPv4());
    if (!config) {
      await Bun.write(Bun.stdout, JSON.stringify({ ok: false }) + "\n");
      process.exit(0);
    }
    await Bun.write(Bun.stdout, JSON.stringify({ ok: true, url: publicUrl(config, bind), port: config.port, bind }) + "\n");
    process.exit(0);
  }
  if (cmd === "cidrs") {
    const config = ensureConfig(process.argv.slice(3));
    await Bun.write(Bun.stdout, JSON.stringify({ ok: true, extraCidrs: config.extraCidrs }) + "\n");
    process.exit(0);
  }
  await serve();
}
