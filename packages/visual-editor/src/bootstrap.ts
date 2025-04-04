/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pkg from "../package.json";
import * as StringsHelper from "@breadboard-ai/shared-ui/strings";
import { MainArguments } from "./index.js";
import { LanguagePack } from "@breadboard-ai/shared-ui/types/types.js";

export { bootstrap };

export type BootstrapArguments = {
  boardServerUrl?: URL;
  connectionServerUrl?: URL;
  requiresSignin?: boolean;
};

function bootstrap(args: BootstrapArguments = {}) {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = MAIN_ICON;
  document.head.appendChild(icon);

  if (FONT_LINK !== undefined) {
    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = FONT_LINK;
    document.head.appendChild(fonts);
  }

  const assetPack = document.createElement("style");
  assetPack.textContent = ASSET_PACK;
  document.head.appendChild(assetPack);

  const fontPack = document.createElement("style");
  fontPack.textContent = FONT_PACK;
  document.head.appendChild(fontPack);

  const params = new URLSearchParams(location.search);
  if (params.has("dark")) {
    globalThis.localStorage.setItem("dark-theme", "true");
  } else if (params.has("light")) {
    globalThis.localStorage.removeItem("dark-theme");
  }

  if (globalThis.localStorage.getItem("dark-theme") === "true") {
    document.documentElement.classList.add("dark-theme");
  }

  async function init() {
    await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);

    const { Main } = await import("./index.js");
    const { SettingsStore } = await import(
      "@breadboard-ai/shared-ui/data/settings-store.js"
    );

    const config: MainArguments = {
      settings: SettingsStore.instance(),
      version: pkg.version,
      gitCommitHash: GIT_HASH,
      boardServerUrl: args?.boardServerUrl,
      connectionServerUrl: args?.connectionServerUrl,
      requiresSignin: args?.requiresSignin,
    };

    window.oncontextmenu = (evt) => evt.preventDefault();

    const main = new Main(config);
    document.body.appendChild(main);

    const Strings = StringsHelper.forSection("Global");
    console.log(
      `[${Strings.from("APP_NAME")} Visual Editor: Version ${pkg.version}; Commit ${GIT_HASH}]`
    );
  }

  init();
}
