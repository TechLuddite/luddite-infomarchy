import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// bar-insets.js is a QML library (`.pragma library`), which bun cannot import.
// Strip that one directive and evaluate the same source the desk loads.
const source = readFileSync(join(import.meta.dir, "bar-insets.js"), "utf8")
  .replace(/^\.pragma library\s*/, "");
const insets = new Function(`${source}\nreturn insets;`)() as (
  bar: { position?: string; barSize?: number; barHidden?: boolean } | null,
  fallbackTop: number,
) => { top: number; right: number; bottom: number; left: number };

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

describe("desk insets follow the live bar", () => {
  test("no bar keeps the historical top strip", () => {
    expect(insets(null, 53)).toEqual({ ...NONE, top: 53 });
    expect(insets(undefined, 40)).toEqual({ ...NONE, top: 40 });
  });

  test("each edge clears only that edge, by the measured thickness", () => {
    expect(insets({ position: "top", barSize: 26, barHidden: false }, 40)).toEqual({ ...NONE, top: 26 });
    expect(insets({ position: "bottom", barSize: 26, barHidden: false }, 40)).toEqual({ ...NONE, bottom: 26 });
    expect(insets({ position: "left", barSize: 28, barHidden: false }, 40)).toEqual({ ...NONE, left: 28 });
    expect(insets({ position: "right", barSize: 28.4, barHidden: false }, 40)).toEqual({ ...NONE, right: 28 });
  });

  test("a hidden bar clears nothing, even when it still reports a size", () => {
    expect(insets({ position: "bottom", barSize: 26, barHidden: true }, 40)).toEqual(NONE);
  });

  test("an empty position still means the top edge", () => {
    expect(insets({ barSize: 30, barHidden: false }, 40)).toEqual({ ...NONE, top: 30 });
    expect(insets({ position: "floating", barSize: 30, barHidden: false }, 40)).toEqual({ ...NONE, top: 30 });
  });

  test("a later call sees the bar where it has moved", () => {
    const bar = { position: "top", barSize: 26, barHidden: false };
    expect(insets(bar, 40).top).toBe(26);
    bar.position = "bottom";
    bar.barSize = 41;
    expect(insets(bar, 40)).toEqual({ ...NONE, bottom: 41 });
    bar.barHidden = true;
    expect(insets(bar, 40)).toEqual(NONE);
  });

  test("a nonsense size does not become a negative margin", () => {
    expect(insets({ position: "left", barSize: -8, barHidden: false }, 40)).toEqual(NONE);
    expect(insets(null, Number.NaN)).toEqual(NONE);
  });
});

describe("the desk binding tracks the bar after load", () => {
  const qml = readFileSync(join(import.meta.dir, "Infomarchy.qml"), "utf8");

  test("shell is injectable and the binding reads the live fields", () => {
    // Omarchy only injects the plugin shell when the root declares `shell`.
    // The three reads have to sit in the binding itself: a function that
    // received the bar object would not subscribe to later position changes.
    expect(qml).toContain("property var shell: null");
    expect(qml).toContain("position: shell.bar.position");
    expect(qml).toContain("barSize: shell.bar.barSize");
    expect(qml).toContain("barHidden: shell.bar.barHidden");
    expect(qml).toContain("topInset: root.barEdgeInsets.top");
    expect(qml).toContain("rightInset: root.barEdgeInsets.right");
    expect(qml).toContain("bottomInset: root.barEdgeInsets.bottom");
    expect(qml).toContain("leftInset: root.barEdgeInsets.left");
    expect(qml).toContain("leftMargin: panel.stageReservation");
  });

  test("qmltestrunner covers a bar that moves after the binding exists", () => {
    const runner = ["/usr/lib/qt6/bin/qmltestrunner", "/usr/bin/qmltestrunner"].find(path => existsSync(path)) || "";
    expect(runner, "install qt6-declarative for qmltestrunner").not.toBe("");
    const result = Bun.spawnSync([runner, "-input", join(import.meta.dir, "qmltests", "tst_bar_insets.qml")], {
      env: { ...process.env, QT_QPA_PLATFORM: "offscreen" },
    });
    const output = result.stdout.toString() + result.stderr.toString();
    expect(output, output).toContain("test_a_bar_moved_after_load_moves_the_inset()");
    expect(output, output).toContain("test_hiding_the_bar_clears_the_inset()");
    expect(output, output).toContain("test_no_bar_keeps_the_top_fallback()");
    expect(output.match(/^FAIL!?\s/m), output).toBeNull();
    expect(output, output).toMatch(/Totals: \d+ passed, 0 failed/);
    expect(result.exitCode, output).toBe(0);
  });
});
