import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup } from 'rollup';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import cardVersion from '../scripts/card-version.mjs';

test('release and dev markers survive minification and cached rebuilds', async () => {
  const root = mkdtempSync(join(tmpdir(), 'zigbee-version-'));
  writeFileSync(join(root, 'entry.js'), "import {version} from './package.json'; console.log(version);");
  let cache;
  try {
    for (const version of ['3.0.0-dev.65', '3.0.0-dev.66', '3.0.0']) {
      writeFileSync(join(root, 'package.json'), JSON.stringify({version}));
      const build = await rollup({ input: join(root, 'entry.js'), plugins: [cardVersion({root}), json(), terser()], cache });
      try {
        cache = build.cache;
        const {output} = await build.generate({format: 'es'});
        const code = output.find(item => item.type === 'chunk').code;
        assert.ok(code.startsWith(`/*! WISER-CARD-VERSION wiser-zigbee-card ${version} */`));
        assert.ok(code.includes(`console.log("${version}")`));
      } finally { await build.close(); }
    }
  } finally { rmSync(root, {recursive: true, force: true}); }
});
