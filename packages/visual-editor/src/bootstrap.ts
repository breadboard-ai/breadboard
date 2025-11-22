/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pkg from "../package.json";
import type { BootstrapArguments, MainArguments } from "./types/types.js";

import {
  LandingUrlInit,
  type LanguagePack,
} from "@breadboard-ai/shared-ui/types/types.js";
import type { GlobalConfig } from "@breadboard-ai/shared-ui/contexts/global-config.js";
import { SigninAdapter } from "@breadboard-ai/shared-ui/utils/signin-adapter";
import {
  makeUrl,
  OAUTH_REDIRECT,
  parseUrl,
} from "@breadboard-ai/shared-ui/utils/urls.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import { connectToOpalShellHost } from "@breadboard-ai/shared-ui/utils/opal-shell-guest.js";

export { bootstrap };

async function getUrlFromBoardServiceFlag(
  boardService: string | undefined
): Promise<URL | undefined> {
  if (!boardService) return undefined;

  const { GoogleDriveBoardServer } = await import(
    "@breadboard-ai/google-drive-kit"
  );

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
  const globalConfig: GlobalConfig = {
    environmentName: CLIENT_DEPLOYMENT_CONFIG.ENVIRONMENT_NAME,
    googleDrive: {
      publishPermissions:
        CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [],
    },
    buildInfo: {
      packageJsonVersion: pkg.version,
      gitCommitHash: GIT_HASH,
    },
    ...bootstrapArgs.deploymentConfiguration,
  };

  const { SettingsStore } = await import(
    "@breadboard-ai/shared-ui/data/settings-store.js"
  );
  const settings = await SettingsStore.restoredInstance();

  const { shellHost, embedHandler, hostOrigin } = await connectToOpalShellHost();
  const signinAdapter = new SigninAdapter(
    shellHost,
    await shellHost.getSignInState()
  );

  const StringsHelper = await import("@breadboard-ai/shared-ui/strings");
  await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);

  const scopeValidation = await signinAdapter.validateScopes();
  const parsedUrl = parseUrl(window.location.href);
  const { lite, page } = parsedUrl;
  if (
    (signinAdapter.state === "signedin" && scopeValidation.ok) ||
    (signinAdapter.state === "signedout" &&
      // Signed-out users can access public graphs
      (page === "graph" ||
        // The Lite gallery has a signed-out mode
        (lite && page === "home")))
  ) {
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

    window.oncontextmenu = (evt) => evt.preventDefault();

    const mainArgs: MainArguments = {
      settings,
      boardServerUrl: await getUrlFromBoardServiceFlag(
        BOARD_SERVICE || bootstrapArgs.defaultBoardService
      ),
      enableTos: ENABLE_TOS,
      tosHtml: TOS_HTML,
      kits: bootstrapArgs.kits,
      graphStorePreloader: bootstrapArgs.graphStorePreloader,
      moduleInvocationFilter: bootstrapArgs.moduleInvocationFilter,
      env: bootstrapArgs.env,
      embedHandler,
      globalConfig,
      shellHost,
      initialSignInState: await shellHost.getSignInState(),
      parsedUrl,
      hostOrigin,
    };
    if (mainArgs.globalConfig.googleDrive.publishPermissions.length === 0) {
      console.warn(
        "No googleDrive.publishPermissions were configured." +
          " Publishing with Google Drive will not be supported."
      );
    }

    if (lite) {
      if (page === "home" && !parsedUrl.new && !parsedUrl.remix) {
        const { LiteHome } = await import("./index-lite-home.js");
        const liteHome = new LiteHome(mainArgs);
        document.body.appendChild(liteHome);
      } else {
        const { LiteMain } = await import("./index-lite.js");
        const liteMain = new LiteMain(mainArgs);
        document.body.appendChild(liteMain);
      }
    } else {
      const { Main } = await import("./index.js");
      const main = new Main(mainArgs);
      document.body.appendChild(main);
    }

    const Strings = StringsHelper.forSection("Global");
    console.log(
      `[${Strings.from("APP_NAME")} Visual Editor: Version ${pkg.version}; Commit ${GIT_HASH}]`
    );
  } else {
    // Prevent endless looping.
    if (
      (window.location.pathname !== "/" &&
        window.location.pathname !== "/_app/") ||
      new URLSearchParams(window.location.search).has("redirect-from-landing")
    ) {
      const { PageNotFound } = await import("./404.js");
      const notFound = new PageNotFound();
      document.body.appendChild(notFound);
      return;
    }

    // Redirect to the landing page.
    const landing: LandingUrlInit = {
      page: "landing",
      redirect: parseUrl(window.location.href),
      oauthRedirect:
        new URL(window.location.href).searchParams.get(OAUTH_REDIRECT) ??
        undefined,
    };
    if (signinAdapter.state === "signedin" && !scopeValidation.ok) {
      console.log(
        "[signin] oauth scopes were missing or unavailable, forcing signin.",
        scopeValidation.error
      );
      await signinAdapter.signOut();
      landing.missingScopes = true;
    }
    window.location.href = makeUrl(landing);
    return;
  }
}
