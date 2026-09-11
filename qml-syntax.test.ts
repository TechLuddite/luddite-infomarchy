import { describe, expect, test } from "bun:test";
import { readdirSync, existsSync } from "fs";
import { join } from "path";

// Every other QML check in this repo matches strings against the file text,
// which cannot tell a valid document from a broken one. A merge that duplicated
// a property and dropped a comma from an array literal passed the whole suite
// and would have failed to load on the desk — the plugin is QML, so a file that
// does not parse is a dead plugin, not a failing test.
//
// qmllint ships with qt6-declarative, which any machine running Quickshell
// already has. Only `[syntax]` findings are gated: those are parse errors and
// are true regardless of imports. Type and binding warnings need the full
// Quickshell type registry to be meaningful and are deliberately not asserted.
const QMLLINT = ["/usr/lib/qt6/bin/qmllint", "/usr/bin/qmllint", "/usr/lib/qt6/bin/qmllint6"]
  .find(path => existsSync(path)) || "";

const files = readdirSync(import.meta.dir).filter(name => name.endsWith(".qml")).sort();

describe("every QML file parses", () => {
  test("qmllint is available to gate this", () => {
    // A skipped gate is a gate that is not there. Fail loudly instead.
    expect(QMLLINT, "install qt6-declarative for qmllint").not.toBe("");
    expect(files.length).toBeGreaterThan(0);
  });

  for (const name of files) {
    test(`${name} has no syntax errors`, () => {
      const result = Bun.spawnSync([QMLLINT, join(import.meta.dir, name)]);
      const output = result.stdout.toString() + result.stderr.toString();
      const syntax = output.split("\n").filter(line => line.includes("[syntax]"));
      expect(syntax, `${name}:\n${syntax.join("\n")}`).toEqual([]);
    });
  }
});
