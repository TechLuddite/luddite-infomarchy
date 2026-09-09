#!/usr/bin/env bun
// LAN Web Mode: HTML of the latest collector snapshot.
// Off until toggled. Token in the path, source IP allowlist, Host check,
// HTML-escaped fields. GET/HEAD for the page. POST /prefs for web section
// visibility and narrow-layout order. Token never travels in argv.

import { networkInterfaces } from "os";
import { randomBytes, timingSafeEqual } from "crypto";
import { isIP } from "net";
import { dirname, join } from "path";
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readlinkSync, readSync, unlinkSync } from "fs";
import { parseJsonBounded, readRegularFileLimited, writePrivateStateFile } from "./collector";
import {
  DEFAULT_NARROW_ORDER, FALLBACK_THEME, WEB_SECTION_IDS, normalizeOrder, parseDashPrefs, parseThemeColors, renderPage,
  type DashPrefs, type ThemeColors,
} from "./web-page";

export {
  displayMount, escapeHtml, fmtBytes, fmtDur, fmtMoney, fmtPct, fmtRate, fmtTokens, fmtUntil,
  providerColorHex, renderMachineSection, renderTrendSvg, renderUsageSection, usageSeriesOf, wifiLabel,
} from "./web-page";

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

export const MAX_TOKENS = 8;
export const MAX_EXTRA_CIDRS = 8;
const CONFIG_MAX_BYTES = 8192;

export type WebToken = {
  id: string;
  token: string;
  label: string;
  createdAt: number;
};

export type WebConfig = {
  tokens: WebToken[];
  port: number;
  extraCidrs: string[];
  listening: boolean;
};

export function validToken(value: unknown): string {
  const token = String(value || "");
  return /^[0-9a-f]{48}$/.test(token) ? token : "";
}

export function validTokenId(value: unknown): string {
  const id = String(value || "");
  return /^[0-9a-f]{8}$/.test(id) ? id : "";
}

export function validTokenLabel(value: unknown): string {
  const label = String(value || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/.test(label) ? label : "";
}

export function validPort(value: unknown): number {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 0;
}

export function newTokenId(): string {
  return randomBytes(4).toString("hex");
}

export function makeToken(label = "default"): WebToken {
  return { id: newTokenId(), token: newToken(), label: validTokenLabel(label) || "default", createdAt: Date.now() };
}

export function parseTokens(parsed: Record<string, unknown>): WebToken[] {
  const out: WebToken[] = [];
  const seen = new Set<string>();
  if (Array.isArray(parsed.tokens)) {
    for (const item of parsed.tokens) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const token = validToken(row.token);
      const id = validTokenId(row.id) || newTokenId();
      const label = validTokenLabel(row.label) || "token";
      const createdAt = Number(row.createdAt);
      if (!token || seen.has(token) || seen.has(id)) continue;
      seen.add(token);
      seen.add(id);
      out.push({ id, token, label, createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now() });
      if (out.length >= MAX_TOKENS) break;
    }
  }
  const legacy = validToken(parsed.token);
  if (legacy && !seen.has(legacy) && out.length < MAX_TOKENS) {
    out.unshift({ id: newTokenId(), token: legacy, label: "default", createdAt: Date.now() });
  }
  return out;
}

export function publicTokenList(config: WebConfig): { id: string; label: string; createdAt: number; suffix: string }[] {
  return config.tokens.map(row => ({ id: row.id, label: row.label, createdAt: row.createdAt, suffix: row.token.slice(-4) }));
}

export function tokenAllowed(got: string, tokens: WebToken[]): boolean {
  let ok = false;
  for (const row of tokens) {
    if (tokensEqual(got, row.token)) ok = true;
  }
  return ok;
}

export function loadConfig(): WebConfig | null {
  const raw = readRegularFileLimited(join(STATE_DIR, CONFIG_NAME), CONFIG_MAX_BYTES);
  if (!raw) return null;
  const parsed = parseJsonBounded(raw, CONFIG_MAX_BYTES, 12);
  if (!parsed || typeof parsed !== "object") return null;
  const tokens = parseTokens(parsed as Record<string, unknown>);
  const port = validPort(parsed.port) || DEFAULT_PORT;
  const extraCidrs = Array.isArray(parsed.extraCidrs)
    ? parsed.extraCidrs.map((item: unknown) => String(item)).filter((item: string) => !!parseCidr(item)).slice(0, MAX_EXTRA_CIDRS)
    : [];
  if (!tokens.length) return null;
  return { tokens, port, extraCidrs, listening: parsed.listening !== false };
}

export function saveConfig(config: WebConfig): boolean {
  return writePrivateStateFile(STATE_DIR, CONFIG_NAME, JSON.stringify({
    tokens: config.tokens,
    port: config.port,
    extraCidrs: config.extraCidrs,
    listening: !!config.listening,
  }) + "\n");
}

export function ensureConfig(extraCidrs: string[] = [], listening?: boolean): WebConfig {
  const existing = loadConfig();
  if (existing) {
    let changed = false;
    if (extraCidrs.length) {
      const merged = [...existing.extraCidrs];
      for (const item of extraCidrs) if (parseCidr(item) && !merged.includes(item)) merged.push(item);
      existing.extraCidrs = merged.slice(0, MAX_EXTRA_CIDRS);
      changed = true;
    }
    if (listening !== undefined && existing.listening !== listening) {
      existing.listening = listening;
      changed = true;
    }
    if (changed) saveConfig(existing);
    return existing;
  }
  const created: WebConfig = {
    tokens: [makeToken("default")],
    port: DEFAULT_PORT,
    extraCidrs: extraCidrs.filter(item => !!parseCidr(item)).slice(0, MAX_EXTRA_CIDRS),
    listening: listening !== false,
  };
  saveConfig(created);
  return created;
}

export function addWebToken(label: string): WebToken | null {
  const config = ensureConfig();
  if (config.tokens.length >= MAX_TOKENS) return null;
  const token = makeToken(label);
  config.tokens.push(token);
  saveConfig(config);
  return token;
}

export function revokeWebToken(id: string): boolean {
  const config = loadConfig();
  if (!config) return false;
  const next = config.tokens.filter(row => row.id !== id);
  if (next.length === config.tokens.length) return false;
  if (!next.length) return false;
  config.tokens = next;
  saveConfig(config);
  return true;
}

export function addExtraCidr(text: string): boolean {
  const cidr = parseCidr(text);
  if (!cidr) return false;
  const config = ensureConfig();
  if (config.extraCidrs.includes(cidr.text)) return true;
  if (config.extraCidrs.length >= MAX_EXTRA_CIDRS) return false;
  config.extraCidrs.push(cidr.text);
  saveConfig(config);
  return true;
}

export function removeExtraCidr(text: string): boolean {
  const cidr = parseCidr(text);
  if (!cidr) return false;
  const config = loadConfig();
  if (!config) return false;
  const next = config.extraCidrs.filter(item => item !== cidr.text);
  if (next.length === config.extraCidrs.length) return false;
  config.extraCidrs = next;
  saveConfig(config);
  return true;
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

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export function contentSecurityPolicy(nonce = ""): string {
  const n = /^[0-9a-f]{32}$/.test(nonce) ? nonce : "";
  const extra = n ? ` script-src 'nonce-${n}'; connect-src 'self';` : "";
  return `default-src 'none'; style-src 'unsafe-inline';${extra} img-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`;
}

const MAX_BG_BYTES = 8 * 1024 * 1024;
const THEME_COLORS_PATH = join(HOME, ".local/state/omarchy/current/theme/colors.toml");
const BACKGROUND_LINK = join(HOME, ".local/state/omarchy/current/background");

export function loadTheme(): ThemeColors {
  const raw = readRegularFileLimited(THEME_COLORS_PATH, 16_384);
  return raw ? parseThemeColors(raw) : FALLBACK_THEME;
}

export function loadDashPrefs(): DashPrefs {
  const raw = readRegularFileLimited(join(STATE_DIR, "dashboard.json"), 256 * 1024);
  if (!raw) return parseDashPrefs({});
  const parsed = parseJsonBounded(raw, 256 * 1024, 16);
  return parseDashPrefs(parsed);
}

export function imageContentType(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  return "";
}

export function resolveBackgroundPath(): string {
  try {
    const target = readlinkSync(BACKGROUND_LINK);
    if (!target) return "";
    return target.startsWith("/") ? target : join(dirname(BACKGROUND_LINK), target);
  } catch {
    return "";
  }
}

export function backgroundRevision(): string {
  try {
    const link = lstatSync(BACKGROUND_LINK);
    const m = Math.round(Number(link.mtimeMs) || 0);
    if (!Number.isFinite(m) || m < 0 || m > 1e16) return "";
    let size = 0;
    try {
      const target = resolveBackgroundPath();
      if (target) {
        const st = lstatSync(target);
        if (st.isFile()) size = st.size;
      }
    } catch {}
    if (!Number.isFinite(size) || size < 0 || size > 1e16) size = 0;
    return m + "-" + Math.floor(size);
  } catch {
    return "";
  }
}

export function readBackgroundImage(): { type: string; bytes: Buffer } | null {
  const path = resolveBackgroundPath();
  if (!path || path.length > 512 || path.includes("\0")) return null;
  let fd = -1;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size <= 0 || st.size > MAX_BG_BYTES) return null;
    const buf = Buffer.allocUnsafe(st.size);
    let off = 0;
    while (off < st.size) {
      const n = readSync(fd, buf, off, Math.min(64 * 1024, st.size - off), off);
      if (n <= 0) break;
      off += n;
    }
    if (off !== st.size) return null;
    const type = imageContentType(buf);
    return type ? { type, bytes: buf } : null;
  } catch {
    return null;
  } finally {
    if (fd >= 0) try { closeSync(fd); } catch {}
  }
}

export function parseAsciiQr(text: string): string[] {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter(line => line.length > 0).slice(0, 80);
  const rows: string[] = [];
  for (const line of lines) {
    let bits = "";
    for (let i = 0; i + 1 < line.length && bits.length < 80; i += 2) bits += line.slice(i, i + 2) === "##" ? "1" : "0";
    if (bits.length) rows.push(bits);
  }
  if (rows.length < 21 || rows.some(row => row.length !== rows[0].length)) return [];
  return rows;
}

export async function qrMatrixForUrl(url: string): Promise<string[]> {
  if (!/^http:\/\/[0-9a-zA-Z.:[\]]+\/t\/[0-9a-f]{48}\/$/.test(url)) return [];
  const proc = Bun.spawn(["/usr/bin/qrencode", "-t", "ASCII", "-m", "0", "-o", "-"], {
    stdin: new Blob([url]),
    stdout: "pipe",
    stderr: "ignore",
  });
  const raw = await new Response(proc.stdout).text();
  await proc.exited;
  return parseAsciiQr(raw);
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": contentSecurityPolicy(),
};

type Reply = { status: number; headers: Record<string, string>; body: string | Uint8Array };

function reply(status: number, body: string | Uint8Array, type = "text/html; charset=utf-8", nonce = ""): Reply {
  return { status, headers: { ...SECURITY_HEADERS, "Content-Type": type, "Content-Security-Policy": contentSecurityPolicy(nonce) }, body };
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

export function jsonContentType(value: string): boolean {
  return String(value || "").split(";")[0].trim().toLowerCase() === "application/json";
}

export function parsePrefsPatch(raw: string): { webSections?: Record<string, boolean>; webNarrowOrder?: string[] } | null {
  const parsed = parseJsonBounded(raw, 4096, 6);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out: { webSections?: Record<string, boolean>; webNarrowOrder?: string[] } = {};
  if (parsed.webSections && typeof parsed.webSections === "object" && !Array.isArray(parsed.webSections)) {
    const sections: Record<string, boolean> = Object.create(null);
    for (const id of WEB_SECTION_IDS) {
      if (Object.prototype.hasOwnProperty.call(parsed.webSections, id)) sections[id] = parsed.webSections[id] === true;
    }
    out.webSections = sections;
  }
  if (Array.isArray(parsed.webNarrowOrder)) out.webNarrowOrder = normalizeOrder(parsed.webNarrowOrder, DEFAULT_NARROW_ORDER);
  if (!out.webSections && !out.webNarrowOrder) return null;
  return out;
}

export function patchDashboardPrefs(patch: { webSections?: Record<string, boolean>; webNarrowOrder?: string[] }): boolean {
  const raw = readRegularFileLimited(join(STATE_DIR, "dashboard.json"), 256 * 1024);
  let parsed: Record<string, unknown> = {};
  if (raw) {
    const current = parseJsonBounded(raw, 256 * 1024, 16);
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    parsed = current as Record<string, unknown>;
  }
  if (patch.webSections) {
    const prev = parsed.webSections && typeof parsed.webSections === "object" && !Array.isArray(parsed.webSections)
      ? parsed.webSections as Record<string, unknown>
      : {};
    const next: Record<string, boolean> = Object.create(null);
    for (const key of Object.keys(prev)) {
      if ((WEB_SECTION_IDS as readonly string[]).includes(key)) next[key] = prev[key] === true;
    }
    for (const id of WEB_SECTION_IDS) {
      if (Object.prototype.hasOwnProperty.call(patch.webSections, id)) next[id] = patch.webSections[id] === true;
    }
    parsed.webSections = next;
  }
  if (patch.webNarrowOrder) parsed.webNarrowOrder = patch.webNarrowOrder;
  return writePrivateStateFile(STATE_DIR, "dashboard.json", JSON.stringify(parsed, null, 2) + "\n");
}

export function handleRequest(input: {
  method: string;
  pathname: string;
  host: string;
  origin: string | null;
  sourceIp: string;
  contentLength: number;
  tokens: WebToken[];
  port: number;
  allowedHosts: string[];
  cidrs: Cidr[];
  snapshot: any | null;
  prefs?: DashPrefs;
  theme?: ThemeColors;
  background?: { type: string; bytes: Buffer } | null;
  body?: string;
  contentType?: string;
}): Reply {
  const method = String(input.method || "").toUpperCase();
  if (input.contentLength > MAX_REQUEST_BYTES) return reply(413, "too large");
  if (!ipAllowed(input.sourceIp, input.cidrs)) return reply(403, "forbidden");
  if (!hostAllowed(input.host, input.allowedHosts, input.port)) return reply(403, "forbidden");
  if (!originAllowed(input.origin, input.allowedHosts, input.port)) return reply(403, "forbidden");
  if (method !== "GET" && method !== "HEAD" && method !== "POST") return reply(405, "method not allowed");

  const path = String(input.pathname || "");
  if (path.length > 256 || path.includes("..") || path.includes("//") || path.includes("\\") || path.includes("%")) return reply(404, "not found");
  const match = path.match(/^\/t\/([0-9a-f]{48})\/(snapshot\.json|bg|prefs)?$/);
  if (!match || !tokenAllowed(match[1], input.tokens || [])) return reply(404, "not found");

  if (method === "POST") {
    if (match[2] !== "prefs") return reply(405, "method not allowed");
    if (!input.origin) return reply(403, "forbidden");
    if (!jsonContentType(input.contentType || "")) return reply(415, "unsupported media type");
    const patch = parsePrefsPatch(input.body || "");
    if (!patch) return reply(400, "bad request");
    if (!patchDashboardPrefs(patch)) return reply(500, "unavailable");
    return reply(200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
  }
  if (match[2] === "prefs") return reply(405, "method not allowed");

  const pagePath = `/t/${match[1]}/`;
  if (match[2] === "bg") {
    const image = input.background === undefined ? readBackgroundImage() : input.background;
    if (!image) return reply(404, "not found");
    const result = reply(200, image.bytes, image.type);
    if (method === "HEAD") result.body = "";
    return result;
  }
  if (!input.snapshot) return reply(503, "collecting");
  const masked = maskSnapshot(input.snapshot);
  if (match[2] === "snapshot.json") {
    const body = JSON.stringify({ ts: masked.ts || 0, ai: { sessions: take(masked.ai?.sessions, 12), attention: take(masked.ai?.attention, 8), usage: masked.ai?.usage || {} } });
    const result = reply(200, body, "application/json; charset=utf-8");
    if (method === "HEAD") result.body = "";
    return result;
  }
  const nonce = newNonce();
  const prefs = input.prefs || loadDashPrefs();
  const theme = input.theme || loadTheme();
  const hasBackground = input.background === undefined ? !!resolveBackgroundPath() : !!input.background;
  const bgRev = input.background === undefined ? backgroundRevision() : (hasBackground ? "1-1" : "");
  const html = renderPage(input.snapshot, pagePath, nonce, prefs, theme, hasBackground, bgRev);
  const result = reply(200, html, "text/html; charset=utf-8", nonce);
  if (method === "HEAD") result.body = "";
  return result;
}

export function loadSnapshot(): any | null {
  const raw = readRegularFileLimited(join(STATE_DIR, SNAPSHOT_NAME), MAX_SNAPSHOT_BYTES);
  if (!raw) return null;
  const parsed = parseJsonBounded(raw, MAX_SNAPSHOT_BYTES, 24);
  return parsed && typeof parsed === "object" ? parsed : null;
}

export function publicUrl(config: WebConfig, bind: string, token?: string): string {
  const value = validToken(token) || config.tokens[0]?.token || "";
  return `http://${bind}:${config.port}/t/${value}/`;
}

export function tokenById(config: WebConfig, id: string): WebToken | null {
  const wanted = validTokenId(id);
  if (!wanted) return config.tokens[0] || null;
  return config.tokens.find(row => row.id === wanted) || null;
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
  const existing = loadConfig();
  if (existing) {
    existing.listening = false;
    saveConfig(existing);
  }
  try { if (existsSync(join(STATE_DIR, SNAPSHOT_NAME))) unlinkSync(join(STATE_DIR, SNAPSHOT_NAME)); } catch {}
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
  const extra = process.argv.filter(arg => parseCidr(arg)).slice(0, MAX_EXTRA_CIDRS);
  const config = ensureConfig(extra, true);
  const bind = advertisedBind(localPrivateIPv4());
  const cidrs = parseCidrList(config.extraCidrs);
  const allowedHosts = [...localPrivateIPv4(), "127.0.0.1"];
  const requestedPort = process.env.INFOMARCHY_WEB_PORT === "0" ? 0 : (validPort(process.env.INFOMARCHY_WEB_PORT) || config.port);
  const server = Bun.serve({
    hostname: "0.0.0.0",
    port: requestedPort,
    maxRequestBodySize: MAX_REQUEST_BYTES,
    idleTimeout: 10,
    async fetch(req, srv) {
      const sourceIp = canonicalIp(srv.requestIP(req)?.address || "");
      if (!rateOk(sourceIp)) return new Response("rate", { status: 429, headers: SECURITY_HEADERS });
      const url = new URL(req.url);
      const live = loadConfig() || config;
      const path = url.pathname;
      const pathname = path.endsWith("/") || path.endsWith("snapshot.json") || path.endsWith("/bg") || path.endsWith("/prefs") ? path : path + "/";
      const result = handleRequest({
        method: req.method,
        pathname,
        host: req.headers.get("host") || "",
        origin: req.headers.get("origin"),
        sourceIp,
        contentLength: Number(req.headers.get("content-length") || 0),
        tokens: live.tokens,
        port: srv.port,
        allowedHosts,
        cidrs: parseCidrList(live.extraCidrs),
        snapshot: loadSnapshot(),
        body: req.method.toUpperCase() === "POST" ? await req.text() : "",
        contentType: req.headers.get("content-type") || "",
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
    const row = tokenById(config, process.argv[3] || "");
    if (!row) {
      await Bun.write(Bun.stdout, JSON.stringify({ ok: false }) + "\n");
      process.exit(0);
    }
    await Bun.write(Bun.stdout, JSON.stringify({ ok: true, url: publicUrl(config, bind, row.token), port: config.port, bind, id: row.id, label: row.label }) + "\n");
    process.exit(0);
  }
  if (cmd === "tokens") {
    const config = loadConfig();
    if (!config) {
      await Bun.write(Bun.stdout, JSON.stringify({ ok: false, tokens: [] }) + "\n");
      process.exit(0);
    }
    await Bun.write(Bun.stdout, JSON.stringify({ ok: true, tokens: publicTokenList(config), extraCidrs: config.extraCidrs, defaults: DEFAULT_CIDRS, listening: config.listening }) + "\n");
    process.exit(0);
  }
  if (cmd === "token-add") {
    const created = addWebToken(process.argv[3] || "token");
    await Bun.write(Bun.stdout, JSON.stringify(created ? { ok: true, id: created.id, label: created.label } : { ok: false }) + "\n");
    process.exit(created ? 0 : 1);
  }
  if (cmd === "token-revoke") {
    const ok = revokeWebToken(process.argv[3] || "");
    await Bun.write(Bun.stdout, JSON.stringify({ ok }) + "\n");
    process.exit(ok ? 0 : 1);
  }
  if (cmd === "cidr-add") {
    const ok = addExtraCidr(process.argv[3] || "");
    await Bun.write(Bun.stdout, JSON.stringify({ ok }) + "\n");
    process.exit(ok ? 0 : 1);
  }
  if (cmd === "cidr-remove") {
    const ok = removeExtraCidr(process.argv[3] || "");
    await Bun.write(Bun.stdout, JSON.stringify({ ok }) + "\n");
    process.exit(ok ? 0 : 1);
  }
  if (cmd === "cidrs") {
    const config = ensureConfig(process.argv.slice(3));
    await Bun.write(Bun.stdout, JSON.stringify({ ok: true, extraCidrs: config.extraCidrs, defaults: DEFAULT_CIDRS }) + "\n");
    process.exit(0);
  }
  if (cmd === "qr") {
    const config = loadConfig();
    const bind = advertisedBind(localPrivateIPv4());
    if (!config) {
      await Bun.write(Bun.stdout, JSON.stringify({ ok: false }) + "\n");
      process.exit(0);
    }
    const row = tokenById(config, process.argv[3] || "");
    if (!row) {
      await Bun.write(Bun.stdout, JSON.stringify({ ok: false }) + "\n");
      process.exit(0);
    }
    const rows = await qrMatrixForUrl(publicUrl(config, bind, row.token));
    await Bun.write(Bun.stdout, JSON.stringify({ ok: rows.length > 0, size: rows.length, rows }) + "\n");
    process.exit(rows.length ? 0 : 1);
  }
  await serve();
}
