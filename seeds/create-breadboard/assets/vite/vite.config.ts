import { config } from "dotenv";
import { defineConfig } from "vite";
import watchAndRun from "vite-plugin-watch-and-run";
import fullReload from "vite-plugin-full-reload";
import path from "path";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default defineConfig(async (_) => {
  config();
  return {
    build: {
      lib: {
        entry: {
          worker: "src/worker.ts",
          sample: "./index.html",
        },
        name: "Breadboard Web Runtime",
        formats: ["es"],
      },
      target: "esnext",
    },
    server: {
      ...buildCustomAllowList(process.env.VITE_FS_ALLOW),
    },
    plugins: [
      watchAndRun([
        {
          watch: path.resolve("src/boards/**/*.ts"),
          run: "npm run generate:graphs",
        },
      ]),
      fullReload(["public/*.json"]),
    ],
  };
});
