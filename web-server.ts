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

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#e5c07b",
  codex: "#56b6c2",
  grok: "#c678dd",
  "grok-bot": "#c678dd",
  gemini: "#61afef",
  hermes: "#98c379",
  ollama: "#98c379",
  opencode: "#61afef",
  pi: "#98c379",
  aider: "#e5c07b",
  copilot: "#c678dd",
};

export function providerColorHex(provider: string): string {
  return PROVIDER_COLORS[String(provider || "").toLowerCase()] || "#abb2bf";
}

export function fmtTokens(n: unknown): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "0";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(0) + "K";
  return String(Math.round(v));
}

export function fmtMoney(n: unknown): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "$0.00";
  if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "k";
  if (v >= 100) return "$" + v.toFixed(0);
  return "$" + v.toFixed(2);
}

export function fmtUntil(iso: string, now = Date.now()): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const s = Math.max(0, (ts - now) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor(s % 3600 / 60) + "m";
  return Math.floor(s / 86400) + "d " + Math.floor(s % 86400 / 3600) + "h";
}

export function fmtBytes(n: unknown): string {
  let v = Number(n || 0);
  if (!Number.isFinite(v) || v < 0) return "0B";
  const units = ["B", "K", "M", "G", "T"];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return (i === 0 ? v.toFixed(0) : v.toFixed(v >= 100 ? 0 : 1)) + units[i];
}

export function fmtRate(n: unknown): string {
  if (n === null || n === undefined || n === "") return "—";
  let v = Number(n) * 8;
  if (!Number.isFinite(v) || v < 0) return "—";
  const units = ["b", "Kb", "Mb", "Gb"];
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + units[i] + "/s";
}

export function fmtPct(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n) + "%";
}

export function fmtDur(sec: unknown): string {
  const s = Math.max(0, Math.floor(Number(sec || 0)));
  if (!Number.isFinite(s)) return "";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + "d " + h + "h";
  if (h > 0) return h + "h " + m + "m";
  return m + "m";
}

export function displayMount(path: unknown): string {
  return String(path || "").replace(/^\/home\/[^/]+/, "~").slice(0, 24);
}

export function wifiLabel(net: any): string {
  const n = net && typeof net === "object" ? net : {};
  if (!n.wireless) return ("NET " + String(n.dev || "—")).slice(0, 20);
  return "WIFI";
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export function contentSecurityPolicy(nonce = ""): string {
  const n = /^[0-9a-f]{32}$/.test(nonce) ? nonce : "";
  const extra = n ? ` script-src 'nonce-${n}'; connect-src 'self';` : "";
  return `default-src 'none'; style-src 'unsafe-inline';${extra} img-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`;
}

const BLUE = "#61afef";
const GREEN = "#98c379";
const YELLOW = "#e5c07b";
const RED = "#e06c75";
const LIVE_SCRIPT = '(function(){function on(){try{return sessionStorage.getItem("im-privacy")!=="0"}catch(e){return true}}function apply(){var p=on();document.body.classList.toggle("privacy",p);var b=document.getElementById("privacy");if(b){b.textContent=p?"PRIVACY ON":"PRIVACY";b.classList.toggle("on",p)}}document.addEventListener("click",function(e){var t=e.target;if(!t||t.id!=="privacy")return;try{sessionStorage.setItem("im-privacy",on()?"0":"1")}catch(x){}apply()});apply();var busy=0;function g(){if(busy)return;busy=1;fetch(location.pathname,{cache:"no-store",credentials:"omit"}).then(function(r){return r.ok?r.text():Promise.reject()}).then(function(h){var d=new DOMParser().parseFromString(h,"text/html");var n=d.getElementById("view"),c=document.getElementById("view");if(!n||!c)return;var y=scrollY;c.replaceWith(document.importNode(n,true));scrollTo(0,y);apply()}).catch(function(){}).then(function(){busy=0})}setInterval(g,5000)})();';

function renderBar(label: string, value: string, fraction: number, fill: string, rawLabel = false): string {
  const pct = Math.max(0, Math.min(1, Number(fraction) || 0));
  const width = Math.round(pct * 1000) / 10;
  const color = /^#[0-9a-fA-F]{6}$/.test(fill) ? fill : "#abb2bf";
  const shown = rawLabel ? label : escapeHtml(label, 32);
  return `<div class="meter"><div class="meter-row"><span>${shown}</span><span>${escapeHtml(value, 48)}</span></div><div class="track"><div class="fill" style="width:${width}%;background:${color}"></div></div></div>`;
}

function usageKeysOf(usage: any): string[] {
  return Object.keys(usage || {}).filter(key => usage[key] && usage[key].ready !== false).slice(0, 8);
}

export function usageSeriesOf(usage: any, metric: "tokens" | "value"): { provider: string; points: number[] }[] {
  const out: { provider: string; points: number[] }[] = [];
  for (const key of usageKeysOf(usage)) {
    const row = usage[key] || {};
    const daily = Array.isArray(row.dailyTokens) ? row.dailyTokens.map((x: unknown) => Number(x) || 0) : [];
    if (!daily.some((x: number) => x > 0)) continue;
    if (metric === "tokens") {
      out.push({ provider: key, points: daily.slice(0, 7) });
      continue;
    }
    const totals = (row.value || {}).totals || {};
    const tokens = Number(totals.inputTokens || 0) + Number(totals.outputTokens || 0) + Number(totals.cacheReadInputTokens || 0) + Number(totals.cacheCreationInputTokens || 0);
    const lifetime = Number((row.value || {}).lifetime);
    if (!Number.isFinite(lifetime) || tokens <= 0) continue;
    const rate = lifetime / tokens;
    out.push({ provider: key, points: daily.slice(0, 7).map((x: number) => x * rate) });
  }
  return out;
}

export function renderTrendSvg(series: { provider: string; points: number[] }[], days: string[], fmt: (n: number) => string): string {
  if (!series.length) return "";
  const n = series[0].points.length;
  if (n < 1) return "";
  let max = 1;
  for (const row of series) for (const p of row.points) max = Math.max(max, p);
  const w = 320, h = 88, left = 44, top = 10, bottom = 72, plot = w - left - 6;
  const xAt = (i: number) => left + (n === 1 ? plot / 2 : i * plot / (n - 1));
  const yAt = (v: number) => bottom - (v / max) * (bottom - top);
  const grid: string[] = [];
  for (let t = 0; t < 3; t++) {
    const y = top + (bottom - top) * t / 2;
    grid.push(`<line x1="${left}" y1="${y.toFixed(1)}" x2="${w}" y2="${y.toFixed(1)}" stroke="#444" stroke-width="1"/>`);
    grid.push(`<text x="2" y="${(y + 3).toFixed(1)}" fill="#888" font-size="9" font-family="ui-monospace,monospace">${escapeHtml(fmt(max * (1 - t / 2)), 12)}</text>`);
  }
  const lines: string[] = [];
  for (const row of series) {
    const color = providerColorHex(row.provider);
    const pts = row.points.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
    const area = `${xAt(0).toFixed(1)},${bottom} ${pts} ${xAt(n - 1).toFixed(1)},${bottom}`;
    lines.push(`<polygon points="${area}" fill="${color}" fill-opacity="0.08"/>`);
    lines.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>`);
  }
  const labels: string[] = [];
  if (n > 1) {
    const first = String(days[0] || "").slice(5);
    const last = String(days[n - 1] || "").slice(5);
    labels.push(`<text x="${left}" y="84" fill="#888" font-size="9" font-family="ui-monospace,monospace">${escapeHtml(first, 8)}</text>`);
    labels.push(`<text x="${w - 2}" y="84" fill="#888" font-size="9" font-family="ui-monospace,monospace" text-anchor="end">${escapeHtml(last, 8)}</text>`);
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" aria-hidden="true">${grid.join("")}${lines.join("")}${labels.join("")}</svg>`;
}

function renderMeter(limit: any, tone: string): string {
  const pct = Math.max(0, Math.min(1, Number(limit.percent) || 0));
  const width = Math.round(pct * 1000) / 10;
  const until = limit.resetsAt ? "  ↻ " + fmtUntil(String(limit.resetsAt)) : "";
  const fill = pct > 0.85 ? "#e06c75" : pct > 0.6 ? "#e5c07b" : tone;
  return `<div class="meter"><div class="meter-row"><span>${escapeHtml(limit.label || limit.title, 32)}</span><span>${escapeHtml(Math.round(pct * 100) + "%" + until, 40)}</span></div><div class="track"><div class="fill" style="width:${width}%;background:${fill}"></div></div></div>`;
}

export function renderUsageSection(snap: any): string {
  const ai = snap.ai || {};
  const usage = ai.usage && typeof ai.usage === "object" ? ai.usage : {};
  const keys = usageKeysOf(usage);
  const parts: string[] = [];
  parts.push(`<h2>USAGE &amp; LIMITS</h2>`);
  if (!keys.length) {
    parts.push(`<div class="card meta">no usage cache yet</div>`);
    return parts.join("");
  }
  const chips = keys.map(key => `<span class="chip" style="color:${providerColorHex(key)};border-color:${providerColorHex(key)}">${escapeHtml(usage[key].name || key, 24)}</span>`).join("");
  parts.push(`<div class="chips">${chips}</div>`);
  for (const key of keys) {
    const row = usage[key] || {};
    const tone = providerColorHex(key);
    const v = row.value || {}, t = v.totals || {};
    const all = Number(t.inputTokens || 0) + Number(t.outputTokens || 0) + Number(t.cacheReadInputTokens || 0) + Number(t.cacheCreationInputTokens || 0);
    const life: string[] = [];
    if (all > 0) life.push("lifetime " + fmtTokens(all) + " tok");
    if (all > 0) life.push(Math.round(100 * Number(t.cacheReadInputTokens || 0) / all) + "% cache reads");
    if (v.lifetime !== null && v.lifetime !== undefined) life.push("≈" + fmtMoney(v.lifetime) + " est.");
    else if (all > 0) life.push("unpriced");
    if (row.totalSessions) life.push(row.totalSessions + " sessions");
    const todayValue = v.today !== null && v.today !== undefined ? " · ≈" + fmtMoney(v.today) : "";
    const limits = take(row.limits, 8).map((limit: any) => renderMeter(limit, tone)).join("");
    const status = row.authHelpText || row.usageStatusText;
    parts.push(`<div class="card" style="border-color:${tone}44"><div class="usage-head"><span class="tag" style="color:${tone}">${escapeHtml(row.name || key, 40)}</span> <span class="meta">${escapeHtml(row.tierLabel, 32)}</span></div><div class="meta">today ${escapeHtml(row.todayPrompts || 0, 12)}p · ${escapeHtml(fmtTokens(row.todayTotalTokens), 16)} tok${escapeHtml(todayValue, 24)}</div>${status ? `<div class="meta">${escapeHtml(status, 200)}</div>` : ""}${life.length ? `<div class="meta">${escapeHtml(life.join(" · "), 220)}</div>` : ""}${limits}</div>`);
  }
  return parts.join("");
}

export function renderMachineSection(snap: any): string {
  const machine = snap && snap.machine && typeof snap.machine === "object" ? snap.machine : {};
  const cpu = machine.cpu && typeof machine.cpu === "object" ? machine.cpu : {};
  const mem = machine.mem && typeof machine.mem === "object" ? machine.mem : {};
  const net = machine.net && typeof machine.net === "object" ? machine.net : {};
  const ping = machine.ping && typeof machine.ping === "object" ? machine.ping : {};
  const bat = machine.battery && typeof machine.battery === "object" ? machine.battery : null;
  const disks = take(machine.disks, 2);
  const cpuPct = Number(cpu.pct);
  const ramPct = Number(mem.pct);
  const load = Array.isArray(cpu.load) ? Number(cpu.load[0]) : NaN;
  const temp = Number(machine.temp);
  const cpuBits = [fmtPct(cpu.pct)];
  if (Number.isFinite(load)) cpuBits.push(load.toFixed(2));
  if (Number.isFinite(temp)) cpuBits.push(Math.round(temp) + "°");
  const ramBits: string[] = [];
  if (mem.used && mem.total) ramBits.push(fmtBytes(mem.used) + "/" + fmtBytes(mem.total));
  ramBits.push(fmtPct(mem.pct));
  const parts: string[] = [];
  parts.push(`<h2>MACHINE</h2><div class="card"><div class="grid">`);
  parts.push(renderBar("CPU", cpuBits.join(" · "), (Number.isFinite(cpuPct) ? cpuPct : 0) / 100, cpuPct > 85 ? RED : BLUE));
  parts.push(renderBar("RAM", ramBits.join(" · "), (Number.isFinite(ramPct) ? ramPct : 0) / 100, ramPct > 90 ? RED : GREEN));
  for (const disk of disks) {
    const d = disk && typeof disk === "object" ? disk : {};
    const pct = Number(d.pct);
    const rawMount = String(d.mount || "/").slice(0, 24);
    const hiddenMount = displayMount(d.mount || "/") || "/";
    const labelHtml = hiddenMount === rawMount
      ? escapeHtml("DISK " + rawMount, 32)
      : `<span class="shut">${escapeHtml("DISK " + hiddenMount, 32)}</span><span class="open">${escapeHtml("DISK " + rawMount, 32)}</span>`;
    const value = (d.used && d.size ? fmtBytes(d.used) + "/" + fmtBytes(d.size) + " · " : "") + fmtPct(d.pct);
    parts.push(renderBar(labelHtml, value, (Number.isFinite(pct) ? pct : 0) / 100, pct > 90 ? RED : YELLOW, true));
  }
  const hasSignal = net.signal !== null && net.signal !== undefined && net.signal !== "";
  const signal = hasSignal ? Number(net.signal) : NaN;
  const wifiFrac = Number.isFinite(signal) ? Math.max(0, Math.min(1, (signal + 90) / 60)) : (net.dev ? 1 : 0);
  const wifiVal = Number.isFinite(signal) ? signal + " dBm" : (net.dev ? "up" : "—");
  const wifiFill = Number.isFinite(signal) && signal < -75 ? YELLOW : GREEN;
  const ssid = String(net.ssid || "").slice(0, 32);
  const wifiShut = wifiLabel(net);
  const wifiOpen = net.wireless ? ("WIFI" + (ssid ? " " + ssid : "")) : wifiShut;
  const wifiLabelHtml = wifiShut === wifiOpen
    ? wifiShut
    : `<span class="shut">${escapeHtml(wifiShut, 20)}</span><span class="open">${escapeHtml(wifiOpen, 40)}</span>`;
  parts.push(renderBar(wifiLabelHtml, wifiVal, wifiFrac, wifiFill, true));
  const pingOk = !!ping.ok;
  const pingMs = Number(ping.ms);
  const pingText = pingOk && Number.isFinite(pingMs) ? Math.round(pingMs) + " ms" : "timeout";
  const pingClass = !pingOk ? "bad" : pingMs > 80 ? "warn" : "ok";
  const batText = bat ? "BAT " + fmtPct(bat.pct) + " " + String(bat.status || "").toLowerCase() : "";
  const batHot = !!(bat && Number(bat.pct) < 20 && String(bat.status || "") !== "Charging");
  const up = machine.uptime ? "up " + fmtDur(machine.uptime) : "";
  const wan = String(machine.externalIp || "").slice(0, 40);
  const lan = String(net.addr || "").slice(0, 40);
  const who = [snap.user, snap.host].filter(Boolean).join("@");
  const openBits = [up, who, wan ? "WAN " + wan : "", lan ? "LAN " + lan : ""].filter(Boolean);
  parts.push(`<div class="span foot"><span class="ok">${escapeHtml("↓" + fmtRate(net.rxRate) + " ↑" + fmtRate(net.txRate), 40)}</span><span class="${pingClass}">${escapeHtml("⇄ " + pingText, 24)}</span>${batText ? `<span class="${batHot ? "bad" : "meta"}">${escapeHtml(batText, 40)}</span>` : ""}</div>`);
  parts.push(`<div class="span meta"><span class="shut">${escapeHtml([up, "WAN/LAN/SSID hidden"].filter(Boolean).join(" · "), 80)}</span><span class="open">${escapeHtml(openBits.join(" · ") || "up", 120)}</span></div>`);
  parts.push(`</div></div>`);
  return parts.join("");
}

export function renderPage(snap: any, refreshPath: string, nonce = ""): string {
  const ai = snap.ai || {};
  const sessions = take(ai.sessions, 12);
  const attention = take(ai.attention, 8);
  const n = /^[0-9a-f]{32}$/.test(nonce) ? nonce : "";
  const rows: string[] = [];
  rows.push(`<!doctype html><html lang="en"><head><meta charset="utf-8">`);
  rows.push(`<meta name="viewport" content="width=device-width,initial-scale=1">`);
  rows.push(`<title>Infomarchy</title><style>
:root { color-scheme: dark; }
body { margin: 0; font: 15px/1.4 ui-sans-serif, system-ui, sans-serif; background: #111; color: #ddd; }
main { max-width: 42rem; margin: 0 auto; padding: 12px; }
h1 { font-size: 1.1rem; margin: 0 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
h1 .tools { display: flex; gap: 12px; align-items: baseline; }
h2 { font-size: 0.8rem; letter-spacing: 0.08em; color: #8ad; margin: 18px 0 8px; }
.card { background: #1b1b1b; border: 1px solid #333; border-radius: 10px; padding: 10px 12px; margin: 0 0 8px; }
.meta { color: #888; font-size: 0.8rem; }
.prompt { color: #eee; }
.tag { display: inline-block; font-size: 0.75rem; letter-spacing: 0.04em; font-weight: 700; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.chip { font: 11px ui-monospace, monospace; border: 1px solid; border-radius: 6px; padding: 2px 7px; }
.chart { padding: 8px 8px 4px; }
.chart-label { font: 11px ui-monospace, monospace; color: #8ad; letter-spacing: 0.06em; margin-bottom: 4px; }
.usage-head { display: flex; gap: 8px; align-items: baseline; }
.meter { margin-top: 8px; }
.meter-row { display: flex; justify-content: space-between; font: 12px ui-monospace, monospace; color: #ccc; }
.track { height: 7px; background: #2a2a2a; border-radius: 4px; margin-top: 4px; overflow: hidden; }
.fill { height: 100%; border-radius: 4px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.grid .meter { margin-top: 0; }
.span { grid-column: 1 / -1; }
.foot { display: flex; flex-wrap: wrap; gap: 10px 14px; font: 12px ui-monospace, monospace; }
.ok { color: #98c379; }
.warn { color: #e5c07b; }
.bad { color: #e06c75; }
a.refresh, button.privacy-btn { color: #8ad; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.06em; text-decoration: none; background: none; border: 0; padding: 0; font-family: inherit; cursor: pointer; }
button.privacy-btn.on { color: #e5c07b; }
body.privacy .open { display: none; }
body:not(.privacy) .shut { display: none; }
@media (max-width: 520px) { .grid { grid-template-columns: 1fr; } }
</style></head><body class="privacy"><main id="view">`);
  rows.push(`<h1>Infomarchy <span class="tools"><button type="button" id="privacy" class="privacy-btn on">PRIVACY ON</button> <a class="refresh" href="${escapeHtml(refreshPath, 200)}">Refresh</a></span></h1><p class="meta">read-only</p>`);
  rows.push(renderUsageSection(snap));

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

  rows.push(renderMachineSection(snap));
  rows.push(`</main>`);
  if (n) rows.push(`<script nonce="${n}">${LIVE_SCRIPT}</script>`);
  rows.push(`</body></html>`);
  return rows.join("");
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": contentSecurityPolicy(),
};

function reply(status: number, body: string, type = "text/html; charset=utf-8", nonce = ""): { status: number; headers: Record<string, string>; body: string } {
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
    const body = JSON.stringify({ ts: masked.ts || 0, ai: { sessions: take(masked.ai?.sessions, 12), attention: take(masked.ai?.attention, 8), usage: masked.ai?.usage || {} } });
    const result = reply(200, body, "application/json; charset=utf-8");
    if (method === "HEAD") result.body = "";
    return result;
  }
  const nonce = newNonce();
  const html = renderPage(input.snapshot, pagePath, nonce);
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
  const requestedPort = process.env.INFOMARCHY_WEB_PORT === "0" ? 0 : (validPort(process.env.INFOMARCHY_WEB_PORT) || config.port);
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
