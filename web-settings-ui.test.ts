import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const settings = readFileSync(join(import.meta.dir, "InfoSettings.qml"), "utf8");
const view = readFileSync(join(import.meta.dir, "InfoView.qml"), "utf8");
const service = readFileSync(join(import.meta.dir, "Infomarchy.qml"), "utf8");

describe("web mode desk controls", () => {
  test("privacy loads only from a saved literal true", () => {
    expect(settings).toContain("privacyMode = !!(parsed && parsed.privacyMode === true)");
  });

  test("the strip and IPC expose WEB and SETTINGS", () => {
    expect(service).toContain("function toggleWeb(): void { dashboardSettings.toggleWebEnabled() }");
    expect(view).toContain('text: view.settings.webEnabled ? (view.settings.webReady ? "WEB ON" : (view.settings.webStarting ? "WEB …" : "WEB FAILED")) : "WEB"');
    expect(view).toContain('text: "SETTINGS"');
    expect(view).not.toContain("PHONE");
    expect(view).toContain("SettingsBody");
    expect(view).not.toContain("visible: view.keyboardAvailable && view.settings.webEnabled && !!view.settings.webUrl");
  });

  test("settings read web status and per-section web visibility", () => {
    expect(settings).toContain('command: ["bun", root.webServerPath, "status"]');
    expect(settings).toContain("function refreshWebStatus()");
    expect(settings).toContain("function webSectionEnabled(id)");
  });
});
