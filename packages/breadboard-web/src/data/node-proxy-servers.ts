import { RunConfig } from "@google-labs/breadboard/harness";
import { SettingsStore } from "./settings-store";
import * as BreadboardUI from "@google-labs/breadboard-ui";

// TODO: Make this configurable, too.
const PROXY_NODES = ["secrets", "fetch"];

export const addNodeProxyServerConfig = (
  config: RunConfig,
  settings: SettingsStore | null
): RunConfig => {
  if (!settings) return config;

  const servers = settings.getSection(
    BreadboardUI.Types.SETTINGS_TYPE.NODE_PROXY_SERVERS
  );
  console.log("settings", servers);
  const values = Array.from(servers.items.values());
  if (!values.length) return config;

  // TODO: Make this work with multiple proxy servers.
  const proxyServerURL = values[0].value;
  if (!proxyServerURL) return config;

  console.log("🚀 Using proxy server:", proxyServerURL);
  config.proxy = [
    { location: "http", url: proxyServerURL as string, nodes: PROXY_NODES },
  ];
  return config;
};
