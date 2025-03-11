/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import pkg from "../../../package.json" with { type: "json" };
import * as StringsHelper from "@breadboard-ai/shared-ui/strings";
import {
  AppTemplate,
  LanguagePack,
} from "@breadboard-ai/shared-ui/types/types.js";
import { AppViewConfig, BootstrapArguments } from "./types/types.js";

import * as Elements from "./elements/elements.js";
import { GraphDescriptor } from "@google-labs/breadboard";
import * as BreadboardUIContext from "@breadboard-ai/shared-ui/contexts";
import { GrantStore } from "./utils/grant.js";
import * as ConnectionClient from "@breadboard-ai/connection-client";
import { SettingsHelper } from "./utils/settings.js";
import { createRunConfigWithProxy } from "./utils/run-config.js";
import { RunConfig } from "@google-labs/breadboard/harness";
import { createFlowRunner } from "./utils/runner.js";

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
  environment: BreadboardUIContext.Environment
): Promise<ConnectionClient.TokenVendor> {
  const grantStore = new GrantStore();
  return ConnectionClient.createTokenVendor(grantStore, environment);
}

async function createRunner(runConfig: RunConfig | null) {
  return createFlowRunner(runConfig);
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
  const flow = await fetchFlow();
  const template = await fetchTemplate(flow);
  const environment = await createEnvironment(args);
  const tokenVendor = await createTokenVendor(environment);
  const settingsHelper = new SettingsHelper();
  const runConfig = await createRunConfigWithProxy(flow, args, tokenVendor);
  const runner = await createRunner(runConfig);

  const config: AppViewConfig = {
    template,
    environment,
    tokenVendor,
    settingsHelper,
    runner,
  };

  console.log(`[App View: Version ${pkg.version}; Commit ${GIT_HASH}]`);

  const appView = new Elements.AppView(config, flow);
  document.body.appendChild(appView);
}

bootstrap({
  proxyServerUrl: new URL("/proxy/", window.location.href),
  boardServerUrl: new URL("/board/", window.location.href),
  connectionServerUrl: new URL("/connection/", window.location.href),
  requiresSignin: true,
});
