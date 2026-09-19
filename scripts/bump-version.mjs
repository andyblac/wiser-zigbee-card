import { readFileSync, writeFileSync } from 'node:fs';

// Tagged releases must retain the version that was explicitly published.
if (process.env.WISER_SKIP_VERSION_BUMP !== '1') {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const match = /^(\d+\.\d+\.\d+-dev\.)(\d+)$/.exec(pkg.version);
  if (!match) process.exit(0);
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const version = `${match[1]}${BigInt(match[2]) + 1n}`;
  pkg.version = lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`Build version: ${version}`);
}
