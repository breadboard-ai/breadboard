import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import config from "./package.json" with { type: "json" };
import dts from "rollup-plugin-dts";

const makeAllTargets = Object.entries(config.exports).map(([name, input]) => {
  name = name === "." ? "index" : name;
  const file = `dist/${name}.min.js`;
  return {
    input,
    output: {
      file,
      format: "esm",
      plugins: [terser()],
      sourcemap: true,
    },
    plugins: [nodeResolve(), json()],
  };
});

makeAllTargets.push({
  input: "dist/src/index.d.ts",
  output: {
    file: "dist/index.d.ts",
    format: "esm",
  },
  plugins: [dts()],
});

export default makeAllTargets;
