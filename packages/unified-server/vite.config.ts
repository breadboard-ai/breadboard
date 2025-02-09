/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, UserConfig } from "vite";

export default defineConfig(async (): Promise<UserConfig> => {
  const languagePackUrl = import.meta.resolve(
    "@breadboard-ai/shared-ui/strings/en_US"
  );

  let languagePack;
  try {
    languagePack = (await import(languagePackUrl)).default;
  } catch (err) {
    throw new Error("Unable to import language pack");
  }

  return {
    optimizeDeps: { esbuildOptions: { target: "esnext" } },
    build: {
      target: "esnext",
      outDir: "dist/client",
      lib: {
        entry: {
          index: "./index.html",
        },
        formats: ["es"],
      },
    },
    define: {
      LANGUAGE_PACK: JSON.stringify(languagePack),
      ASSET_PACK: "{}",
      ASSET_PACK_ICONS: "[]",
      MAIN_ICON: JSON.stringify("main.svg"),
    },
    resolve: {
      dedupe: ["lit"],
    },
  };
});
