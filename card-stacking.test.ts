import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

// The other QML gates here match source text (qml-syntax) or resolve names
// (qml-resolve). Neither can answer the one question that decides whether a
// control on a session card works at all: does a pointer reach it? The card's
// own focus/inspect MouseArea is declared after the column holding its
// contents, and declaration order is paint order, so it sits on top of
// everything inside and swallows their clicks. That is invisible to a string
// match and to qmllint, and it silently disabled the grouped-roster rows before
// anyone noticed.
//
// qmltestrunner ships with qt6-declarative, the same package that provides the
// qmllint the other gates use, so requiring it adds no dependency. The fixture
// lives under qmltests/ so the two directory-scanning gates do not have to
// carry a ceiling for a file that is not part of the plugin.
const RUNNER = ["/usr/lib/qt6/bin/qmltestrunner", "/usr/bin/qmltestrunner"].find(path => existsSync(path)) || "";
const FIXTURE = join(import.meta.dir, "qmltests", "tst_cardstacking.qml");
const view = readFileSync(join(import.meta.dir, "InfoView.qml"), "utf8");

describe("a control on a session card is actually clickable", () => {
  test("qmltestrunner is available to gate this", () => {
    // A skipped gate is a gate that is not there. Fail loudly instead.
    expect(RUNNER, "install qt6-declarative for qmltestrunner").not.toBe("");
    expect(existsSync(FIXTURE)).toBe(true);
  });

  test("the fixture still matches how the real card is stacked", () => {
    // If the card is ever restructured so its MouseArea comes first, the lift
    // is dead weight and this fixture is testing a shape that no longer exists.
    const card = view.lastIndexOf("delegate: Rectangle {\n                id: sc");
    const column = view.indexOf("id: scol", card);
    const area = view.indexOf("id: hover", card);
    expect(column).toBeGreaterThan(0);
    expect(area).toBeGreaterThan(column);
    expect(view.slice(column, area)).toContain("z: 1");
  });

  test("synthetic clicks land where they should", () => {
    const result = Bun.spawnSync([RUNNER, "-input", FIXTURE], {
      env: { ...process.env, QT_QPA_PLATFORM: "offscreen" },
    });
    const output = result.stdout.toString() + result.stderr.toString();
    expect(output, output).toContain("test_an_inner_control_receives_its_own_click()");
    expect(output, output).toContain("test_the_name_is_part_of_the_same_target()");
    expect(output, output).toContain("test_the_caret_is_part_of_the_same_target()");
    expect(output, output).toContain("test_the_card_still_takes_every_other_pixel()");
    expect(output, output).toContain("test_without_the_lift_the_card_swallows_it()");
    expect(output.match(/^FAIL!?\s/m), output).toBeNull();
    expect(output, output).toMatch(/Totals: \d+ passed, 0 failed/);
    expect(result.exitCode, output).toBe(0);
  });
});
