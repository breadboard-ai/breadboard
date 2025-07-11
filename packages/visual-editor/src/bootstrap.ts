/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pkg from "../package.json";
import * as StringsHelper from "@breadboard-ai/shared-ui/strings";
import { BootstrapArguments, MainArguments } from "./types/types.js";
import { LanguagePack } from "@breadboard-ai/shared-ui/types/types.js";
import { GoogleDriveBoardServer } from "@breadboard-ai/google-drive-kit";
import { type GoogleDrivePermission } from "@breadboard-ai/shared-ui/contexts/environment.js";

export { bootstrap };

function getUrlFromBoardServiceFlag(
  boardService: string | undefined
): URL | undefined {
  if (!boardService) return undefined;

  if (boardService.startsWith(GoogleDriveBoardServer.PROTOCOL)) {
    // Just say GDrive here, it will be appended with the folder ID once it's fetched in
    // packages/visual-editor/src/index.ts
    return new URL(boardService);
  } else if (boardService.startsWith("/")) {
    // Convert relative URLs.
    return new URL(boardService, window.location.href);
  }
  // Fallback.
  return new URL(boardService);
}

async function bootstrap(bootstrapArgs: BootstrapArguments) {
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

  if (bootstrapArgs.embedHandler) {
    bootstrapArgs.embedHandler.connect();
  }

  await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);

  const [{ Main }, { SettingsStore }] = await Promise.all([
    import("./index.js"),
    import("@breadboard-ai/shared-ui/data/settings-store.js"),
  ]);

  const mainArgs: MainArguments = {
    settings: await SettingsStore.restoredInstance(),
    buildInfo: {
      packageJsonVersion: pkg.version,
      gitCommitHash: GIT_HASH,
    },
    boardServerUrl: getUrlFromBoardServiceFlag(
      BOARD_SERVICE || bootstrapArgs.defaultBoardService
    ),
    enableTos: ENABLE_TOS,
    tosHtml: TOS_HTML,
    kits: bootstrapArgs.kits,
    graphStorePreloader: bootstrapArgs.graphStorePreloader,
    moduleInvocationFilter: bootstrapArgs.moduleInvocationFilter,
    env: bootstrapArgs.env,
    embedHandler: bootstrapArgs.embedHandler,
    clientDeploymentConfiguration: bootstrapArgs.deploymentConfiguration,
    environment: {
      connectionServerUrl:
        bootstrapArgs.connectionServerUrl?.href ||
        import.meta.env.VITE_CONNECTION_SERVER_URL,
      connectionRedirectUrl: "/oauth/",
      environmentName: ENVIRONMENT_NAME,
      requiresSignin: bootstrapArgs.requiresSignin,
      googleDrive: {
        publishPermissions: JSON.parse(
          import.meta.env.VITE_GOOGLE_DRIVE_PUBLISH_PERMISSIONS || `[]`
        ) as GoogleDrivePermission[],
        publicApiKey: import.meta.env.VITE_GOOGLE_DRIVE_PUBLIC_API_KEY ?? "",
      },
    },
  };
  if (mainArgs.environment.googleDrive.publishPermissions.length === 0) {
    console.warn(
      "No googleDrive.publishPermissions were configured." +
        " Publishing with Google Drive will not be supported."
    );
  }

  window.oncontextmenu = (evt) => evt.preventDefault();

  const main = new Main(mainArgs);
  document.body.appendChild(main);

  const Strings = StringsHelper.forSection("Global");
  console.log(
    `[${Strings.from("APP_NAME")} Visual Editor: Version ${pkg.version}; Commit ${GIT_HASH}]`
  );
}
