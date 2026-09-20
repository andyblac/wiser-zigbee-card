import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const script = fileURLToPath(
  new URL("../scripts/bump-version.mjs", import.meta.url),
);

test("build bumps only dev versions in both package files and preserves tagged releases", () => {
  const root = mkdtempSync(join(tmpdir(), "zigbee-bump-"));
  try {
    for (const [before, after, skip] of [
      ["3.0.0-dev.68", "3.0.0-dev.69", ""],
      ["3.0.0-dev.69", "3.0.0-dev.70", ""],
      ["3.0.0-beta.1", "3.0.0-beta.1", ""],
      ["3.0.0-rc.1", "3.0.0-rc.1", ""],
      ["3.0.0", "3.0.0", ""],
      ["3.0.0-dev.69", "3.0.0-dev.69", "1"],
      ["3.0.0", "3.0.0", "1"],
    ]) {
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ version: before, scripts: { build: "example" } }),
      );
      writeFileSync(
        join(root, "package-lock.json"),
        JSON.stringify({
          version: before,
          packages: {
            "": { version: before },
            dependency: { version: "1.0.0" },
          },
        }),
      );
      execFileSync(process.execPath, [script], {
        cwd: root,
        env: { ...process.env, WISER_SKIP_VERSION_BUMP: skip },
      });
      const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      const lock = JSON.parse(
        readFileSync(join(root, "package-lock.json"), "utf8"),
      );
      assert.equal(pkg.version, after);
      assert.equal(lock.version, after);
      assert.equal(lock.packages[""].version, after);
      assert.equal(lock.packages.dependency.version, "1.0.0");
      assert.equal(pkg.scripts.build, "example");
      if (before === after) {
        assert.equal(
          readFileSync(join(root, "package.json"), "utf8"),
          JSON.stringify({ version: before, scripts: { build: "example" } }),
        );
        assert.equal(
          readFileSync(join(root, "package-lock.json"), "utf8"),
          JSON.stringify({
            version: before,
            packages: {
              "": { version: before },
              dependency: { version: "1.0.0" },
            },
          }),
        );
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
