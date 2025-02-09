/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import fs from "node:fs/promises";

export const buildCustomAllowList = (value?: string) => {
  if (!value) return {};
  return { fs: { allow: [value] } };
};

async function processAssetPack(src: string) {
  const srcPath = path.join(__dirname, src);
  const files = await fs.readdir(srcPath, { withFileTypes: true });

  const assets: [string, string][] = [];
  const styles: string[] = [];
  let mainIcon = "";
  for (const file of files) {
    // TODO: Support nested dirs.
    if (file.isDirectory()) {
      continue;
    }

    const filePath = path.join(file.parentPath, file.name);
    const fileNameAsStyleProp = path
      .basename(file.name, path.extname(file.name))
      .replaceAll(/\./gim, "-");

    let mimeType;
    const data = await fs.readFile(filePath, { encoding: "binary" });
    switch (path.extname(file.name)) {
      case ".svg": {
        mimeType = "image/svg+xml";
        break;
      }

      case ".png": {
        mimeType = "image/png";
        break;
      }

      case ".jpg": {
        mimeType = "image/jpeg";
        break;
      }

      default:
        continue;
    }

    const base64Str = `data:${mimeType};base64,${btoa(data)}`;
    assets.push([fileNameAsStyleProp, base64Str]);
    styles.push(`--bb-${fileNameAsStyleProp}: url("${base64Str}")`);

    // Special-case the logo.
    if (file.name === "logo.svg") {
      mainIcon = `data:${mimeType};base64,${btoa(data)}`;
    }
  }

  return {
    mainIcon,
    styles: `/**
    * @license
    * Copyright 2025 Google LLC
    * SPDX-License-Identifier: Apache-2.0
    */
    :root {
      ${styles.join(";\n")};
    }`,
    assets,
  };
}

export default defineConfig(async ({ mode }) => {
  config();

  const envConfig = { ...loadEnv(mode, process.cwd()) };
  if (!envConfig.VITE_LANGUAGE_PACK) {
    throw new Error("Language Pack not specified");
  }

  if (!envConfig.VITE_ASSET_PACK) {
    throw new Error("Asset Pack not specified");
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

  const assetPack = await processAssetPack(envConfig.VITE_ASSET_PACK);
  const entry = {
    worker: "src/worker.ts",
    sample: "./index.html",
    oauth: "./oauth/index.html",
    bbrt: "./experimental/bbrt/index.html",
    "core-kit": "src/core-kit.ts",
    "json-kit": "src/json-kit.ts",
    "template-kit": "src/template-kit.ts",
    "python-wasm-kit": "src/python-wasm-kit.ts",
  };

  if (mode === "development") {
    entry["langage"] = "./language.html";
  }

  return {
    build: {
      lib: {
        entry,
        name: "Breadboard Web Runtime",
        formats: ["es"],
      },
      target: "esnext",
    },
    define: {
      LANGUAGE_PACK: JSON.stringify(languagePack),
      ASSET_PACK: JSON.stringify(assetPack.styles),
      ASSET_PACK_ICONS: JSON.stringify(assetPack.assets),
      MAIN_ICON: JSON.stringify(assetPack.mainIcon),
    },
    server: {
      ...buildCustomAllowList(process.env.VITE_FS_ALLOW),
    },
    test: {
      include: ["tests/**/*.ts"],
    },
    optimizeDeps: {
      exclude: [
        // @breadboard-ai/python-wasm has dependency on pyodide (which is the
        // Python WASM runtime), but it's not compatible with Vite
        // optimizations.
        "pyodide",
      ],
    },
    resolve: {
      dedupe: ["lit"],
    },
  };
});
