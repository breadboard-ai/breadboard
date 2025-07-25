/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from "path";
import fs from "fs/promises";
import { type Plugin } from "vite";

export { configureAssets, policyContent };

function policyContent(
  policyPath = "./policy.html",
  policyContent: string = "Not set"
): Plugin {
  return {
    name: "policy-content",
    transformIndexHtml(html, opts) {
      if (opts.originalUrl !== policyPath) {
        return html;
      }

      return policyContent;
    },
  };
}

export type ConfigureAssetsInputs = {
  VITE_LANGUAGE_PACK?: string;
  VITE_ASSET_PACK?: string;
  VITE_FONT_FACE_MONO?: string;
  VITE_FONT_FACE?: string;
  VITE_FONT_FACE_FLEX?: string;
  VITE_FONT_LINK?: string;
  /** Supported values are: "drive:" or "/board/". */
  VITE_BOARD_SERVICE?: string;
  VITE_ENABLE_TOS?: boolean;
  VITE_TOS_HTML_PATH?: string;
  VITE_ENABLE_POLICY?: boolean;
  VITE_POLICY_HTML_PATH?: string;
  VITE_ENVIRONMENT_NAME?: string;
};

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
  ENVIRONMENT_NAME: string;
};

async function configureAssets(
  root: string,
  config: ConfigureAssetsInputs
): Promise<ConfigureAssetOutputs> {
  const {
    VITE_LANGUAGE_PACK: LANGUAGE_PACK,
    VITE_ASSET_PACK: ASSET_PACK,
    VITE_FONT_FACE: FONT_FACE,
    VITE_FONT_FACE_FLEX: FONT_FACE_FLEX,
    VITE_FONT_FACE_MONO: FONT_FACE_MONO,
    VITE_FONT_LINK: FONT_LINK,
    VITE_BOARD_SERVICE: BOARD_SERVICE,
    VITE_ENABLE_TOS: ENABLE_TOS,
    VITE_TOS_HTML_PATH: TOS_HTML_PATH,
    VITE_ENABLE_POLICY: ENABLE_POLICY,
    VITE_POLICY_HTML_PATH: POLICY_HTML_PATH,
    VITE_ENVIRONMENT_NAME: ENVIRONMENT_NAME,
  } = config;

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

  let tosHtml = "";
  if (TOS_HTML_PATH) {
    const tosHtmlPath = path.join(root, TOS_HTML_PATH);
    tosHtml = await fs.readFile(tosHtmlPath, { encoding: "utf-8" });
  }

  let policyHtml = undefined;
  if (POLICY_HTML_PATH) {
    const policyHtmlPath = path.join(root, POLICY_HTML_PATH);
    policyHtml = await fs.readFile(policyHtmlPath, { encoding: "utf-8" });
  }

  return {
    LANGUAGE_PACK: JSON.stringify(languagePack),
    ASSET_PACK: JSON.stringify(assetPack.styles),
    ASSET_PACK_ICONS: JSON.stringify(assetPack.assets),
    MAIN_ICON: JSON.stringify(assetPack.mainIcon),
    FONT_PACK: JSON.stringify(assetPack.fonts),
    FONT_LINK: JSON.stringify(FONT_LINK),
    BOARD_SERVICE: JSON.stringify(BOARD_SERVICE),
    ENABLE_TOS: ENABLE_TOS ?? false,
    TOS_HTML: JSON.stringify(tosHtml),
    ENABLE_POLICY: ENABLE_POLICY ?? false,
    POLICY_HTML: JSON.stringify(policyHtml),
    ENVIRONMENT_NAME: JSON.stringify(ENVIRONMENT_NAME),
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
