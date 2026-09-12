import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Stamp an explicit version after minification in production and watch builds. */
export default function cardVersion({ root = process.cwd() } = {}) {
  const packagePath = resolve(root, 'package.json');
  let version;
  return {
    name: 'wiser-card-version',
    buildStart() {
      version = JSON.parse(readFileSync(packagePath, 'utf8')).version;
    },
    shouldTransformCachedModule({ id }) {
      return id === packagePath ? true : null;
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          chunk.code = `/*! WISER-CARD-VERSION wiser-zigbee-card ${version} */\n${chunk.code}`;
        }
      }
    },
  };
}
