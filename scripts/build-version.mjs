import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RELEASE = /^(\d+)\.(\d+)\.(\d+)$/;
const BETA = /^(\d+\.\d+\.\d+-beta)\.(\d+)$/;
const DEVELOPMENT = /^(\d+\.\d+\.\d+)-dev\.(\d+)$/;
const BETA_DEVELOPMENT = /^(\d+\.\d+\.\d+-beta\.\d+)-dev\.(\d+)$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export default function buildVersion({
  dev = false,
  final = false,
  root = process.cwd(),
} = {}) {
  const packagePath = resolve(root, "package.json");
  let packageData;
  let packageVersion;
  let version;
  let resourceUrl;

  return {
    name: "build-version",
    buildStart() {
      packageData = JSON.parse(readFileSync(packagePath, "utf8"));
      packageVersion = packageData.version;
      version = packageVersion;
      if (dev) {
        const release = RELEASE.exec(packageVersion);
        const beta = BETA.exec(packageVersion);
        const development = DEVELOPMENT.exec(packageVersion);
        const betaDevelopment = BETA_DEVELOPMENT.exec(packageVersion);
        if (betaDevelopment)
          version = `${betaDevelopment[1]}-dev.${BigInt(betaDevelopment[2]) + 1n}`;
        else if (development)
          version = `${development[1]}-dev.${BigInt(development[2]) + 1n}`;
        else if (beta) version = `${beta[1]}.${BigInt(beta[2]) + 1n}-dev.1`;
        else if (release)
          version = `${release[1]}.${release[2]}.${BigInt(release[3]) + 1n}-dev.1`;
        else
          throw new Error(
            `Cannot create a dev build from version ${packageVersion}`,
          );
      } else {
        const development = DEVELOPMENT.exec(packageVersion);
        const betaDevelopment = BETA_DEVELOPMENT.exec(packageVersion);
        const beta = BETA.exec(packageVersion);
        if (final && betaDevelopment)
          version = betaDevelopment[1].replace(/-beta\.\d+$/, "");
        else if (final && beta) version = beta[1].replace(/-beta$/, "");
        else if (betaDevelopment) version = betaDevelopment[1];
        else if (development) version = development[1];
      }
      if (!SEMVER.test(version)) {
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
      if (version !== packageVersion) {
        packageData.version = version;
        writeFileSync(packagePath, `${JSON.stringify(packageData, null, 2)}\n`);
      }
      console.info(`\nBuilt ${version}\nDashboard resource: ${resourceUrl}\n`);
    },
  };
}
