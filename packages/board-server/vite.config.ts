/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, loadEnv, UserConfig } from "vite";

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const envConfig = { ...loadEnv(mode, process.cwd()) };
  if (!envConfig.VITE_LANGUAGE_PACK) {
    throw new Error("Language Pack not specified");
  }

  const languagePackUrl = await import.meta.resolve(
    envConfig.VITE_LANGUAGE_PACK
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
      outDir: "./dist/client",
      lib: {
        entry: {
          index: "./index.html",
          api: "./api.html",
          oauth: "./oauth/index.html",
          editor: "./experimental/editor.html",
        },
        formats: ["es"],
      },
    },
    define: {
      LANGUAGE_PACK: JSON.stringify(languagePack),
      ASSET_PACK: "{}",
      ASSET_PACK_ICONS: "[]",
    },
    resolve: {
      dedupe: ["lit"],
    },
  };
});
