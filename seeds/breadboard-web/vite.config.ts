import { config } from "dotenv";
import { defineConfig } from "vitest/config";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

export default defineConfig(async ({ mode }) => {
  config();

  console.log(mode, process.env.VITE_FS_ALLOW, process.cwd());

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
    test: {
      include: ["tests/**/*.ts"],
    },
  };
});
