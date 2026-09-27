import buildVersion from "./scripts/build-version.mjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import babel from "@rollup/plugin-babel";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import ignore from "./rollup-plugins/ignore";
import { ignoreTextfieldFiles } from "./elements/ignore/textfield";
import { ignoreSelectFiles } from "./elements/ignore/select";
import { ignoreSwitchFiles } from "./elements/ignore/switch";

const plugins = (dev = false) => [
  buildVersion({ dev }),
  nodeResolve(),
  typescript(),
  json(),
  babel({
    exclude: "node_modules/**",
    babelHelpers: "bundled",
  }),
  terser(),
  ignore({
    // eslint-disable-next-line no-undef
    files: [
      ...ignoreTextfieldFiles,
      ...ignoreSelectFiles,
      ...ignoreSwitchFiles,
    ].map((file) => require.resolve(file)),
  }),
];

export default (args) => [
  {
    input: "src/wiser-zigbee-card.ts",
    output: {
      dir: "dist",
      format: "iife",
      name: "wiserzigbeecard",
      sourcemap: false,
    },
    plugins: plugins(Boolean(args.configDev)),
    context: "window",
  },
];
