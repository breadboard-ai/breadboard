/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessProxyConfig, RunConfig } from "@google-labs/breadboard/harness";
import { SettingsStore } from "./settings-store";
import * as BreadboardUI from "@google-labs/breadboard-ui";

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

export const addNodeProxyServerConfig = (
  existingProxy: HarnessProxyConfig[],
  config: RunConfig,
  settings: SettingsStore | null,
  proxyUrl?: string | undefined
): RunConfig => {
  // TODO: Consolidate proxyUrl into settings.
  const proxy = [...existingProxy];
  if (proxyUrl) {
    proxy.push({ location: "python", url: proxyUrl, nodes: PYTHON_NODES });
  }
  if (!settings) return { ...config, proxy };

  const servers = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.NODE_PROXY_SERVERS
  );
  if (!servers) return config;
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
