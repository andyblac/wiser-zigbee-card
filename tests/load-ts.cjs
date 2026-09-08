const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const ts = require("typescript");
module.exports = function loadTs(filename, mocks = {}) {
  const file = path.resolve(filename);
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
      esModuleInterop: true,
      experimentalDecorators: true,
    },
  }).outputText;
  const output = { exports: {} };
  const realRequire = createRequire(file);
  new Function("require", "module", "exports", compiled)(
    (id) => (Object.hasOwn(mocks, id) ? mocks[id] : realRequire(id)),
    output,
    output.exports,
  );
  return output.exports;
};
