/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import pkg from "../../../package.json" with { type: "json" };
import * as StringsHelper from "@breadboard-ai/shared-ui/strings";
import {
  AppTemplate,
  AppTheme,
  LanguagePack,
  SETTINGS_TYPE,
  SettingsHelper,
} from "@breadboard-ai/shared-ui/types/types.js";
import { AppViewConfig, BootstrapArguments } from "./types/types.js";

import * as Elements from "./elements/elements.js";
import {
  GraphDescriptor,
  isInlineData,
  isStoredData,
} from "@google-labs/breadboard";
import * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import * as ConnectionClient from "@breadboard-ai/connection-client";
import { SettingsHelperImpl } from "./utils/settings.js";
import { createRunConfigWithProxy } from "./utils/run-config.js";
import { RunConfig } from "@google-labs/breadboard/harness";
import { createFlowRunner } from "./utils/runner.js";
import { getGlobalColor } from "./utils/color.js";
import { LLMContent } from "@breadboard-ai/types";

const primaryColor = getGlobalColor("--bb-ui-700");
const secondaryColor = getGlobalColor("--bb-ui-400");
const backgroundColor = getGlobalColor("--bb-neutral-0");
const textColor = getGlobalColor("--bb-neutral-900");
const primaryTextColor = getGlobalColor("--bb-neutral-0");

async function fetchFlow() {
  try {
    const url = new URL(window.location.href);
    const matcher = /^\/app\/(.*?)\/(.*)\.app/;
    const matches = matcher.exec(url.pathname);
    if (!matches) {
      return null;
    }

    const fetchPath = `/board/boards/${matches[1]}/${matches[2]}.bgl.json`;
    const response = await fetch(fetchPath);
    if (!response.ok) {
      return null;
    }

    const flow = (await response.json()) as GraphDescriptor;
    return flow;
  } catch (err) {
    return null;
  }
}

async function fetchTemplate(
  flow: GraphDescriptor | null
): Promise<AppTemplate> {
  let template: AppTemplate | null = null;
  if (flow && flow.metadata?.visual?.presentation?.template) {
    const templateName = flow.metadata.visual.presentation.template;
    switch (templateName) {
      case "basic": {
        const mod = await import(
          "@breadboard-ai/shared-ui/app-templates/basic"
        );
        template = new mod.Template();
        break;
      }

      default: {
        break;
      }
    }
  }

  // Fall back to the basic template if we are unable to find the correct one.
  if (template === null) {
    console.warn(`Unable to find specified template`);
    const mod = await import("@breadboard-ai/shared-ui/app-templates/basic");
    template = new mod.Template();
  }

  return template;
}

async function createEnvironment(
  args: BootstrapArguments
): Promise<BreadboardUIContext.Environment> {
  return {
    connectionServerUrl: args.connectionServerUrl?.href,
    connectionRedirectUrl: "/oauth/",
    requiresSignin: args.requiresSignin,
    plugins: {
      input: [],
    },
  };
}

async function createTokenVendor(
  settingsHelper: SettingsHelper,
  environment: BreadboardUIContext.Environment
): Promise<ConnectionClient.TokenVendor> {
  return ConnectionClient.createTokenVendor(
    {
      get: (connectionId: string) => {
        return settingsHelper.get(SETTINGS_TYPE.CONNECTIONS, connectionId)
          ?.value as string;
      },
      set: async (connectionId: string, grant: string) => {
        await settingsHelper.set(SETTINGS_TYPE.CONNECTIONS, connectionId, {
          name: connectionId,
          value: grant,
        });
      },
    },
    environment
  );
}

async function createRunner(runConfig: RunConfig | null) {
  return createFlowRunner(runConfig);
}

function createDefaultTheme(): AppTheme {
  return {
    primaryColor: primaryColor,
    secondaryColor: secondaryColor,
    backgroundColor: backgroundColor,
    textColor: textColor,
    primaryTextColor: primaryTextColor,
    splashScreen: {
      storedData: {
        handle: "/images/app/generic-flow.jpg",
        mimeType: "image/jpeg",
      },
    },
  };
}

function extractThemeFromFlow(flow: GraphDescriptor | null): {
  theme: AppTheme;
  templateAdditionalOptionsChosen: Record<string, string>;
  title: string;
  description: string | null;
} | null {
  let title = "Untitled App";
  let description: string | null = null;
  let templateAdditionalOptionsChosen: Record<string, string> = {};

  const theme: AppTheme = createDefaultTheme();

  if (flow?.metadata?.visual?.presentation) {
    title =
      flow.metadata.visual.presentation.title ?? flow.title ?? "Untitled App";

    description =
      flow.metadata.visual.presentation.description ?? flow.description ?? null;

    const themeColors = flow.metadata.visual.presentation.themeColors;
    const splashScreen = flow.assets?.["@@splash"];

    if (themeColors) {
      theme.primaryColor = themeColors["primaryColor"] ?? primaryColor;
      theme.secondaryColor = themeColors["secondaryColor"] ?? secondaryColor;
      theme.backgroundColor = themeColors["backgroundColor"] ?? backgroundColor;
      theme.textColor = themeColors["textColor"] ?? textColor;
      theme.primaryTextColor =
        themeColors["primaryTextColor"] ?? primaryTextColor;

      if (splashScreen) {
        const splashScreenData = splashScreen.data as LLMContent[];
        if (splashScreenData.length && splashScreenData[0].parts.length) {
          const splash = splashScreenData[0].parts[0];
          if (isInlineData(splash) || isStoredData(splash)) {
            theme.splashScreen = splash;
          }
        }
      }
    }

    if (flow.metadata.visual.presentation.templateAdditionalOptions) {
      templateAdditionalOptionsChosen = {
        ...flow.metadata.visual.presentation.templateAdditionalOptions,
      };
    }
  }

  return {
    theme,
    title,
    description,
    templateAdditionalOptionsChosen,
  };
}

async function bootstrap(args: BootstrapArguments = {}) {
  const icon = document.createElement("link");
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = MAIN_ICON;
  document.head.appendChild(icon);

  const assetPack = document.createElement("style");
  assetPack.textContent = ASSET_PACK;
  document.head.appendChild(assetPack);

  window.oncontextmenu = (evt) => evt.preventDefault();

  await StringsHelper.initFrom(LANGUAGE_PACK as LanguagePack);

  async function initAppView() {
    const flow = await fetchFlow();
    const template = await fetchTemplate(flow);
    const environment = await createEnvironment(args);
    const settingsHelper = new SettingsHelperImpl();
    const tokenVendor = await createTokenVendor(settingsHelper, environment);
    const runConfig = await createRunConfigWithProxy(flow, args, tokenVendor);
    const runner = await createRunner(runConfig);

    const extractedTheme = extractThemeFromFlow(flow);
    const config: AppViewConfig = {
      template,
      environment,
      tokenVendor,
      settingsHelper,
      runner,
      theme: extractedTheme?.theme ?? null,
      title: extractedTheme?.title ?? null,
      description: extractedTheme?.description ?? null,
      templateAdditionalOptions:
        extractedTheme?.templateAdditionalOptionsChosen ?? null,
    };

    const appView = new Elements.AppView(config, flow);
    document.body.appendChild(appView);

    appView.addEventListener("reset", async (evt: Event) => {
      if (!(evt.target instanceof HTMLElement)) {
        return;
      }

      evt.target.remove();
      await initAppView();
    });
  }

  console.log(`[App View: Version ${pkg.version}; Commit ${GIT_HASH}]`);
  await initAppView();
}

bootstrap({
  proxyServerUrl: new URL("/board/proxy/", window.location.href),
  boardServerUrl: new URL("/board/", window.location.href),
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
});
