import { expect, test } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";

// Exercise decoded pixels: checking the fillMode string cannot catch an
// AnimatedImage that was already stretched by sourceSize before painting.
test("still and animated wallpapers retain their proportions when rendered", () => {
  const runner = ["/usr/lib/qt6/bin/qmltestrunner", "/usr/bin/qmltestrunner"]
    .find(path => existsSync(path));
  expect(runner, "install qt6-declarative for the wallpaper rendering test").toBeDefined();
  const run = Bun.spawnSync([runner!, "-input", join(import.meta.dir, "tests/tst_wallpaper.qml")], {
    env: {
      ...process.env,
      QT_QPA_PLATFORM: "offscreen",
      QT_QUICK_BACKEND: "software",
      QT_SCALE_FACTOR: "1",
      QT_SCREEN_SCALE_FACTORS: "",
    },
    timeout: 15000,
  });
  expect(run.exitCode, run.stdout.toString() + run.stderr.toString()).toBe(0);
}, 20000);
