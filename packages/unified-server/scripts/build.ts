import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/server/main.ts"],
  bundle: true,
  platform: "node",
  external: [],
  format: "esm",
  outfile: "dist/server/main.ts",
  sourcemap: true,
});
