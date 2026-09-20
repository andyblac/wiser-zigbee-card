import { readFileSync, writeFileSync } from "node:fs";

// A build after a stable release starts the next patch's development series.
// Tagged release builds set the skip flag to retain the published version.
if (process.env.WISER_SKIP_VERSION_BUMP !== "1") {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const development = /^(\d+\.\d+\.\d+-dev\.)(\d+)$/.exec(pkg.version);
  const release = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
  if (!development && !release) process.exit(0);
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const version = development
    ? `${development[1]}${BigInt(development[2]) + 1n}`
    : `${release[1]}.${release[2]}.${BigInt(release[3]) + 1n}-dev.1`;
  pkg.version = lock.version = version;
  if (lock.packages?.[""]) lock.packages[""].version = version;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Build version: ${version}`);
}
