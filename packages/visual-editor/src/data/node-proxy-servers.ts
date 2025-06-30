/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HarnessProxyConfig, RunConfig } from "@breadboard-ai/types";
import { SettingsStore } from "@breadboard-ai/shared-ui/data/settings-store.js";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

type SettingEntry = {
  name: string;
  value: string | number | boolean;
};

const PYTHON_NODES = ["runPython"];

const createNodeProxyConfig = (entry: SettingEntry) => {
  const url = entry.name;
  if (!url) return null;

  const nodesAsString = entry.value as string;
  if (!nodesAsString) return null;

  const nodes = nodesAsString.split(",").map((nodeType) => nodeType.trim());

  return { location: "http", url, nodes };
};

const useLocaLSecretsOnly = (settings: SettingsStore | null) => {
  if (!settings) return false;

  const generalSettings = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.GENERAL
  );
  if (!generalSettings) return false;

  const runLocally = generalSettings.items.get("Use Local Secrets Only");
  return runLocally && runLocally.value === true;
};

export const addNodeProxyServerConfig = (
  existingProxy: HarnessProxyConfig[],
  config: RunConfig,
  settings: SettingsStore | null,
  proxyUrl: string | undefined,
  boardServerProxyUrl: string | null
): RunConfig => {
  // TODO: Consolidate proxyUrl into settings.
  const proxy = [...existingProxy];
  if (proxyUrl) {
    proxy.push({ location: "python", url: proxyUrl, nodes: PYTHON_NODES });
  }
  if (boardServerProxyUrl) {
    if (useLocaLSecretsOnly(settings)) {
      console.log(
        `[Board Server] Ignoring node proxy because "Use Local Secrets Only" is set.`
      );
    } else {
      proxy.push({
        location: "http",
        url: boardServerProxyUrl,
        nodes: ["secrets", "fetch"],
      });
      config.interactiveSecrets = "fallback";
      console.log(
        "[Board Server] Using node proxy:",
        boardServerProxyUrl.replace(/\?API_KEY=.+$/, "")
      );
    }
  }
  if (!settings) return { ...config, proxy };

  const servers = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.NODE_PROXY_SERVERS
  );
  if (!servers) return { ...config, proxy };
  const values = Array.from(servers.items.values());
  if (!values.length) return { ...config, proxy };

  proxy.push(
    ...(values
      .map(createNodeProxyConfig)
      .filter(Boolean) as HarnessProxyConfig[])
  );

  if (!proxy.length) return { ...config, proxy };

  console.log("🚀 Using proxy servers:", proxy);
  return { ...config, proxy };
};
