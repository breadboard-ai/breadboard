import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  external: ["firebase-functions/v2/https", "firebase-functions"],
  input: "lib/index.js",
  output: {
    file: "lib/bundle.js",
    sourcemap: "inline",
    format: "esm",
    plugins: [terser()],
  },
  plugins: [
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    json(),
  ],
};
