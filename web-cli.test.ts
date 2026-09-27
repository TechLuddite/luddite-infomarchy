import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const root = mkdtempSync(join(tmpdir(), "infomarchy-web-cli-"));
const sleeper = Bun.spawn(["/usr/bin/sleep", "120"], { stdout: "ignore", stderr: "ignore" });
afterAll(async () => { sleeper.kill("SIGKILL"); await sleeper.exited; rmSync(root, { recursive: true, force: true }); });

const tokens = [
  { id: "aaaaaaaa", token: "a".repeat(44) + "1111", label: "phone", createdAt: 1 },
  { id: "bbbbbbbb", token: "b".repeat(44) + "2222", label: "tablet", createdAt: 2 },
];

function processStart(pid: number): string {
  const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
  return raw.slice(raw.lastIndexOf(")") + 2).split(" ")[19] || "";
}

// A ready Private HTTPS listener as the status command sees it: a live pid,
// a matching start time, an HTTPS tailnet origin and a listening web.json.
function readyState(list = tokens): string {
  const state = mkdtempSync(join(root, "state-"));
  const dir = join(state, "infomarchy");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, "web.json"), JSON.stringify({ tokens: list, port: 8787, extraCidrs: [], listening: true }), { mode: 0o600 });
  writeFileSync(join(dir, "web-status.json"), JSON.stringify({
    ready: true, mode: "tailscale", origin: "https://desk.example.ts.net:8788", message: "", pid: sleeper.pid, start: processStart(sleeper.pid),
  }), { mode: 0o600 });
  return state;
}

async function cli(state: string, ...args: string[]) {
  const proc = Bun.spawn([process.execPath, join(import.meta.dir, "web-server.ts"), ...args], {
    env: { HOME: root, XDG_STATE_HOME: state, PATH: "/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe",
  });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out, err, json: JSON.parse(out.trim()) };
}

describe("url prints no credential unless asked", () => {
  test("without --reveal it prints the id and suffix only", async () => {
    const state = readyState();
    for (const args of [["url"], ["url", "bbbbbbbb"]]) {
      const r = await cli(state, ...args);
      expect(r.code).toBe(0);
      expect(r.out + r.err).not.toMatch(/[0-9a-f]{48}/);
      expect(r.out).not.toContain("https://");
      expect(r.json.ok).toBe(true);
      expect(r.json.url).toBeUndefined();
      expect(r.json.hint).toContain("--reveal");
    }
    const second = (await cli(state, "url", "bbbbbbbb")).json;
    expect(second).toMatchObject({ id: "bbbbbbbb", label: "tablet", suffix: "2222" });
    expect((await cli(state, "url")).json).toMatchObject({ id: "aaaaaaaa", suffix: "1111" });
  });

  test("--reveal prints the link, in either argument order", async () => {
    const state = readyState();
    const link = "https://desk.example.ts.net:8788/t/" + tokens[1].token + "/";
    expect((await cli(state, "url", "bbbbbbbb", "--reveal")).json.url).toBe(link);
    expect((await cli(state, "url", "--reveal", "bbbbbbbb")).json.url).toBe(link);
    expect((await cli(state, "url", "--reveal")).json.url).toBe("https://desk.example.ts.net:8788/t/" + tokens[0].token + "/");
  });

  test("status and tokens never print a full token", async () => {
    const state = readyState();
    for (const args of [["status"], ["tokens"]]) {
      const r = await cli(state, ...args);
      expect(r.out + r.err).not.toMatch(/[0-9a-f]{48}/);
    }
  });
});
