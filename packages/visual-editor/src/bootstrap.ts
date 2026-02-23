/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pkg from "../package.json" with { type: "json" };
import type { BootstrapArguments, MainArguments } from "./types/types.js";

import { LandingUrlInit } from "./sca/types.js";
import { type LanguagePack } from "./ui/types/types.js";
import type { GlobalConfig } from "./sca/types.js";
import { SigninAdapter } from "./ui/utils/signin-adapter.js";
import { makeUrl, OAUTH_REDIRECT, parseUrl } from "./ui/navigation/urls.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "./ui/config/client-deployment-configuration.js";
import { connectToOpalShellHost } from "./ui/utils/opal-shell-guest.js";
import { Utils } from "./sca/utils.js";

export { bootstrap };

const logger = Utils.Logging.getLogger();

function setColorScheme(colorScheme?: "light" | "dark") {
  const scheme =
    document.head.querySelector("#scheme") ?? document.createElement("style");
  scheme.id = "scheme";

  if (colorScheme) {
    scheme.textContent = `:root { --color-scheme: ${colorScheme}; }`;
  } else {
    const defaultScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const setScheme = (query: MediaQueryList) => {
      const chosenScheme: "light" | "dark" = query.matches ? "dark" : "light";
      scheme.textContent = `:root { --color-scheme: ${chosenScheme}; }`;
    };
    setScheme(defaultScheme);

    // Watch for changes.
    defaultScheme.addEventListener("change", () => {
      setScheme(defaultScheme);
    });
  }
  document.head.appendChild(scheme);
}

async function bootstrap(bootstrapArgs: BootstrapArguments) {
  const { shellHost, embedHandler, hostOrigin } =
    await connectToOpalShellHost();

  const globalConfig: GlobalConfig = {
    environmentName: CLIENT_DEPLOYMENT_CONFIG.ENVIRONMENT_NAME,
    googleDrive: {
      publishPermissions:
        CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_PUBLISH_PERMISSIONS ?? [],
    },
    buildInfo: {
      packageJsonVersion: pkg.default.version,
      gitCommitHash: GIT_HASH,
    },
    ...bootstrapArgs.deploymentConfiguration,
    hostOrigin,
  };

  const signinAdapter = new SigninAdapter(shellHost);

  const StringsHelper = await import("./ui/strings/helper.js");
  await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);

  const guestConfiguration = await shellHost.getConfiguration();
  const parsedUrl = parseUrl(window.location.href);
  const { lite, page, colorScheme } = parsedUrl;
  if (
    // Signed-out users can access public graphs.
    page === "graph" ||
    // The open page prompts to sign-in and then redirects.
    page === "open" ||
    // The Lite gallery has a signed-out mode.
    (page === "home" && lite) ||
    // IMPORTANT: Keep this `await` as the last condition, so that we don't need
    // to block on it in all of the above cases which don't care about signin.
    (await signinAdapter.state) === "signedin"
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
      enableTos: ENABLE_TOS,
      tosHtml: TOS_HTML,
      env: bootstrapArgs.env,
      embedHandler,
      globalConfig,
      guestConfiguration,
      shellHost,
      parsedUrl,
      hostOrigin,
    };
    if (mainArgs.globalConfig.googleDrive.publishPermissions.length === 0) {
      logger.log(
        Utils.Logging.Formatter.warning(
          "No googleDrive.publishPermissions were configured." +
            " Publishing with Google Drive will not be supported."
        ),
        "Bootstrap"
      );
    }

    setColorScheme(colorScheme);
    embedHandler.addEventListener("theme_change", (evt) => {
      if (evt.type !== "theme_change") {
        return;
      }

      setColorScheme(evt.message.theme);
    });

    if (page === "open") {
      const { OpenMain } = await import("./index-open.js");
      const main = new OpenMain(mainArgs);
      document.body.appendChild(main);
    } else if (lite) {
      if (page === "home" && !parsedUrl.new) {
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
    logger.log(
      Utils.Logging.Formatter.info(
        `Visual Editor: Version ${pkg.default.version}; Commit ${GIT_HASH}]`
      ),
      Strings.from("APP_NAME")
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
      guestPrefixed: true,
    };
    const scopeValidation = await signinAdapter.validateScopes();
    if ((await signinAdapter.state) === "signedin" && !scopeValidation.ok) {
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
