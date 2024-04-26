import { HarnessProxyConfig, RunConfig } from "@google-labs/breadboard/harness";
import { SettingsStore } from "./settings-store";
import * as BreadboardUI from "@google-labs/breadboard-ui";

type SettingEntry = {
  name: string;
  value: string | number | boolean;
};

const createNodeProxyConfig = (entry: SettingEntry) => {
  const url = entry.name;
  if (!url) return null;

  const nodesAsString = entry.value as string;
  if (!nodesAsString) return null;

  const nodes = nodesAsString.split(",").map((nodeType) => nodeType.trim());

  return { location: "http", url, nodes };
};

export const addNodeProxyServerConfig = (
  config: RunConfig,
  settings: SettingsStore | null
): RunConfig => {
  if (!settings) return config;

  const servers = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.NODE_PROXY_SERVERS
  );
  const values = Array.from(servers.items.values());
  if (!values.length) return config;

  const proxy = values
    .map(createNodeProxyConfig)
    .filter(Boolean) as HarnessProxyConfig[];

  if (!proxy.length) return config;

  console.log("🚀 Using proxy servers:", proxy);
  return { ...config, proxy };
};
