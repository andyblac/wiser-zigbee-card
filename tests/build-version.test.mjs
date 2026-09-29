import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import buildVersion from "../scripts/build-version.mjs";

test("successful builds advance package versions through stable and beta development cycles", () => {
  const root = mkdtempSync(join(tmpdir(), "wiser-zigbee-version-"));
  const packagePath = join(root, "package.json");
  const packageLockPath = join(root, "package-lock.json");
  const setRelease = (version) => {
    writeFileSync(packagePath, JSON.stringify({ version }));
    writeFileSync(
      packageLockPath,
      JSON.stringify({ version, packages: { "": { version } } }),
    );
  };
  const run = (dev, success = true, final = false) => {
    const plugin = buildVersion({ dev, final, root });
    plugin.buildStart();
    const version = JSON.parse(
      plugin.transform(readFileSync(packagePath, "utf8"), packagePath).code,
    ).version;
    plugin.generateBundle.call({
      emitFile(asset) {
        const info = JSON.parse(asset.source);
        assert.equal(info.version, version);
        assert.equal(
          info.resourceUrl,
          `/wiser/wiser-zigbee-card.js?v=${version}`,
        );
      },
    });
    if (success) plugin.writeBundle();
    return version;
  };
  try {
    setRelease("3.0.2");
    assert.equal(run(true, false), "3.0.3-beta.1-dev.1");
    assert.equal(
      JSON.parse(readFileSync(packagePath, "utf8")).version,
      "3.0.2",
    );
    assert.equal(run(true), "3.0.3-beta.1-dev.1");
    assert.equal(
      JSON.parse(readFileSync(packageLockPath, "utf8")).version,
      "3.0.3-beta.1-dev.1",
    );
    assert.equal(
      JSON.parse(readFileSync(packageLockPath, "utf8")).packages[""].version,
      "3.0.3-beta.1-dev.1",
    );
    assert.equal(run(true), "3.0.3-beta.1-dev.2");
    assert.equal(run(false), "3.0.3-beta.1");
    assert.equal(run(true), "3.0.3-beta.2-dev.1");
    setRelease("3.1.1-beta.1");
    assert.equal(run(true), "3.1.1-beta.2-dev.1");
    assert.equal(run(true), "3.1.1-beta.2-dev.2");
    assert.equal(run(false, false, true), "3.1.1");
    assert.equal(run(false), "3.1.1-beta.2");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("cached Rollup rebuilds stamp the next version into the JavaScript", async () => {
  const { rollup } = await import("rollup");
  const { default: json } = await import("@rollup/plugin-json");
  const root = mkdtempSync(join(tmpdir(), "wiser-zigbee-version-cache-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ version: "3.0.2" }),
  );
  writeFileSync(
    join(root, "entry.js"),
    "import {version} from './package.json'; console.log(version);",
  );
  let cache;
  const plugin = buildVersion({ dev: true, root });
  try {
    for (const number of [1, 2]) {
      const bundle = await rollup({
        input: join(root, "entry.js"),
        plugins: [plugin, json()],
        cache,
      });
      try {
        cache = bundle.cache;
        const { output } = await bundle.write({
          dir: join(root, "dist"),
          format: "es",
        });
        const code = output.find((item) => item.type === "chunk").code;
        assert.ok(
          code.startsWith(
            `/*! WISER-CARD-VERSION wiser-zigbee-card 3.0.3-beta.1-dev.${number} */`,
          ),
        );
      } finally {
        await bundle.close();
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("release tags must match the semantic package version", () => {
  const root = mkdtempSync(join(tmpdir(), "wiser-zigbee-release-"));
  const previousTag = process.env.RELEASE_TAG;
  try {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ version: "3.1.0-beta.1" }),
    );
    process.env.RELEASE_TAG = "v3.1.0-beta.1";
    buildVersion({ root }).buildStart();
    process.env.RELEASE_TAG = "v3.1.0";
    assert.throws(() => buildVersion({ root }).buildStart(), /does not match/);
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ version: "3.1.0-beta.2-dev.7" }),
    );
    process.env.RELEASE_TAG = "v3.1.0-beta.2";
    buildVersion({ root }).buildStart();
    process.env.RELEASE_TAG = "v3.1.0";
    buildVersion({ root, final: true }).buildStart();
  } finally {
    if (previousTag === undefined) delete process.env.RELEASE_TAG;
    else process.env.RELEASE_TAG = previousTag;
    rmSync(root, { recursive: true, force: true });
  }
});
