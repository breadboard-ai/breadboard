import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

import config from "./package.json" assert { type: "json" };

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
    plugins: [nodeResolve()],
  };
});

export default makeAllTargets;
