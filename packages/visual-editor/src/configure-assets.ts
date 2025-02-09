/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import fs from "fs/promises";

export { configureAssets };

export type ConfigureAssetsInputs = {
  VITE_LANGUAGE_PACK?: string;
  VITE_ASSET_PACK?: string;
};

export type ConfigureAssetOutputs = {
  LANGUAGE_PACK: string;
  ASSET_PACK: string;
  ASSET_PACK_ICONS: string;
  MAIN_ICON: string;
};

async function configureAssets(
  root: string,
  config: ConfigureAssetsInputs
): Promise<ConfigureAssetOutputs> {
  const { VITE_LANGUAGE_PACK: LANGUAGE_PACK, VITE_ASSET_PACK: ASSET_PACK } =
    config;

  if (!LANGUAGE_PACK) {
    throw new Error("Language Pack not specified");
  }

  if (!ASSET_PACK) {
    throw new Error("Asset Pack not specified");
  }

  const languagePackUrl = import.meta.resolve(LANGUAGE_PACK);

  let languagePack;
  try {
    languagePack = (await import(languagePackUrl)).default;
  } catch (err) {
    throw new Error("Unable to import language pack");
  }

  const assetPack = await processAssetPack(root, ASSET_PACK);

  return {
    LANGUAGE_PACK: JSON.stringify(languagePack),
    ASSET_PACK: JSON.stringify(assetPack.styles),
    ASSET_PACK_ICONS: JSON.stringify(assetPack.assets),
    MAIN_ICON: JSON.stringify(assetPack.mainIcon),
  };
}

async function processAssetPack(root: string, src: string) {
  const srcPath = path.join(root, src);
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

    let mimeType: string;
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
