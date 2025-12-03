/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import fs from "fs/promises";

export { configureAssets };


const LANGUAGE_PACK = "../dist/src/opal-lang.js";
const ASSET_PACK = "langs/icons";
const FONT_FACE_MONO = '"Google Sans Code", "Courier New", Courier, monospace"';
const FONT_FACE =
  '"Google Sans", "Helvetica Neue", Helvetica, Arial, sans-serif"';
const FONT_FACE_FLEX =
  '"Google Sans Flex", "Helvetica Neue", Helvetica, Arial, sans-serif"';
const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Google+Sans+Code&family=Google+Sans+Flex:opsz,wght,ROND@6..144,1..1000,100&family=Google+Sans:opsz,wght@17..18,400..700&display=block";

const POLICY_HTML_PATH = "public/policy.html";
const TOS_HTML_PATH = "public/tos.html";
const ENABLE_TOS = true;
const ENABLE_POLICY = true;
const BOARD_SERVICE = "drive:";

export type ConfigureAssetOutputs = {
  LANGUAGE_PACK: string;
  ASSET_PACK: string;
  ASSET_PACK_ICONS: string;
  MAIN_ICON: string;
  FONT_PACK: string;
  FONT_LINK: string;
  BOARD_SERVICE: string;
  ENABLE_TOS: boolean;
  TOS_HTML: string;
  ENABLE_POLICY: boolean;
  POLICY_HTML: string;
};

async function configureAssets(root: string): Promise<ConfigureAssetOutputs> {
  const languagePackUrl = import.meta.resolve(LANGUAGE_PACK);

  let languagePack;
  try {
    languagePack = (await import(languagePackUrl)).default;
  } catch {
    throw new Error("Unable to import language pack");
  }

  const assetPack = await processAssetPack(
    root,
    ASSET_PACK,
    FONT_FACE,
    FONT_FACE_MONO,
    FONT_FACE_FLEX
  );

  const tosHtml = await fs.readFile(path.join(root, TOS_HTML_PATH), {
    encoding: "utf-8",
  });
  const policyHtml = await fs.readFile(path.join(root, POLICY_HTML_PATH), {
    encoding: "utf-8",
  });

  return {
    LANGUAGE_PACK: JSON.stringify(languagePack),
    ASSET_PACK: JSON.stringify(assetPack.styles),
    ASSET_PACK_ICONS: JSON.stringify(assetPack.assets),
    MAIN_ICON: JSON.stringify(assetPack.mainIcon),
    FONT_PACK: JSON.stringify(assetPack.fonts),
    FONT_LINK: JSON.stringify(FONT_LINK),
    BOARD_SERVICE: JSON.stringify(BOARD_SERVICE),
    ENABLE_TOS,
    TOS_HTML: JSON.stringify(tosHtml),
    ENABLE_POLICY,
    POLICY_HTML: JSON.stringify(policyHtml),
  };
}

async function processAssetPack(
  root: string,
  src: string,
  fontFace?: string,
  fontFaceMono?: string,
  fontFaceFlex?: string
) {
  const srcPath = path.join(root, src);
  const files = await fs.readdir(srcPath, { withFileTypes: true });

  const assets: [string, string][] = [];
  const styles: string[] = [];
  const fonts: string[] = [];
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
    if (path.parse(file.name).name === "logo") {
      mainIcon = `data:${mimeType};base64,${btoa(data)}`;
    }
  }

  if (fontFace) {
    fonts.push(`--bb-font-family: ${fontFace}`);
  }

  if (fontFaceMono) {
    fonts.push(`--bb-font-family-mono: ${fontFaceMono}`);
  }

  if (fontFaceFlex) {
    fonts.push(`--bb-font-family-flex: ${fontFaceFlex}`);
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
    fonts: `/**
    * @license
    * Copyright 2025 Google LLC
    * SPDX-License-Identifier: Apache-2.0
    */
    :root {
      ${fonts.join(";\n")};
    }`,
    assets,
  };
}
