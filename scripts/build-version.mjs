import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Keep the release version in package.json and the local dev counter outside dist,
// so cleaning build output does not reuse a cache-busting version.
export default function buildVersion({ dev = false, root = process.cwd() } = {}) {
  const packagePath = resolve(root, "package.json");
  const counterPath = resolve(root, ".dev-build.json");
  let version;
  let baseVersion;
  let build;
  let resourceUrl;

  return {
    name: "build-version",
    buildStart() {
      baseVersion = JSON.parse(readFileSync(packagePath, "utf8")).version;
      version = baseVersion;
      if (dev) {
        const release = /^(\d+)\.(\d+)\.(\d+)$/.exec(baseVersion);
        const prerelease = /^(\d+)\.(\d+)\.(\d+)-[0-9A-Za-z.-]+(?:\+[0-9A-Za-z.-]+)?$/.exec(baseVersion);
        const development = /^(\d+\.\d+\.\d+-dev)\.\d+$/.exec(baseVersion);
        const developmentBase = release
          ? `${release[1]}.${release[2]}.${BigInt(release[3]) + 1n}-dev`
          : prerelease
            ? `${prerelease[1]}.${prerelease[2]}.${BigInt(prerelease[3]) + 1n}-dev`
            : development?.[1];
        if (!developmentBase)
          throw new Error(`Cannot create a dev build from version ${baseVersion}`);
        let previous;
        try {
          previous = JSON.parse(readFileSync(counterPath, "utf8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (
          previous &&
          (!Number.isSafeInteger(previous.build) || previous.build < 0)
        ) {
          throw new Error("Invalid dev build counter in .dev-build.json");
        }
        build =
          previous?.baseVersion === developmentBase ? previous.build + 1 : 1;
        version = `${developmentBase}.${build}`;
        baseVersion = developmentBase;
      }
      if (
        !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
          version,
        )
      ) {
        throw new Error(
          `Build requires a semantic package version, received ${version}`,
        );
      }
      if (
        process.env.RELEASE_TAG &&
        process.env.RELEASE_TAG !== `v${version}`
      ) {
        throw new Error(
          `Release tag ${process.env.RELEASE_TAG} does not match package version v${version}`,
        );
      }
      resourceUrl = `/wiser/wiser-zigbee-card.js?v=${version}`;
    },
    shouldTransformCachedModule({ id }) {
      // Re-stamp package metadata on every watch rebuild, even when it is unchanged.
      return id === packagePath ? true : null;
    },
    transform(code, id) {
      if (id !== packagePath) return null;
      return {
        code: JSON.stringify({ ...JSON.parse(code), version }),
        map: null,
      };
    },
    generateBundle(_options, bundle = {}) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === "chunk" && chunk.isEntry) {
          chunk.code = `/*! WISER-CARD-VERSION wiser-zigbee-card ${version} */\n${chunk.code}`;
        }
      }
      this.emitFile({
        type: "asset",
        fileName: "build-info.json",
        source: `${JSON.stringify({ version, resourceUrl }, null, 2)}\n`,
      });
    },
    writeBundle() {
      if (dev)
        writeFileSync(
          counterPath,
          `${JSON.stringify({ baseVersion, build }, null, 2)}\n`,
        );
      console.info(`\nBuilt ${version}\nDashboard resource: ${resourceUrl}\n`);
    },
  };
}
