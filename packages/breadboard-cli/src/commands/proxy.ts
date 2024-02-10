/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { asRuntimeKit } from "@google-labs/breadboard";
import { ProxyOptions } from "./commandTypes.js";
import { startServer as startProxyServer } from "./lib/proxy-server.js";
import { ProxyServerConfig } from "@google-labs/breadboard/remote";
import { pathToFileURL } from "url";
import { readFile } from "fs/promises";

// The config file format. It's based on ProxyServerConfig, but the kits are strings.
type SimpleProxyServerConfig = Omit<ProxyServerConfig, "kits"> & {
  kits: string[];
};

export const proxy = async (options: ProxyOptions) => {
  const kitDeclarations = options.kit as string[] | undefined;
  const proxyNodeDeclarations = options.proxyNode as string[] | undefined;
  const port = options.port;

  let config: ProxyServerConfig;

  if (options.config != undefined) {
    if (kitDeclarations != undefined || proxyNodeDeclarations != undefined) {
      console.warn(
        "You are using a config file and specifying kits and proxy nodes. The config file will override the command line options."
      );
    }
    config = await loadConfig(options);
  } else {
    config = { kits: [], proxy: [] };

    if (kitDeclarations != undefined) {
      // We should warn if we are importing code and the associated risks
      config.kits = await loadKits(kitDeclarations);
    } else {
      throw new Error("You must specify at least one kit.");
    }

    if (
      proxyNodeDeclarations != undefined &&
      proxyNodeDeclarations.length == 0
    ) {
      throw new Error(
        "You must specify at least one proxy node if you are using a proxy."
      );
    }

    config.proxy = proxyNodeDeclarations || [];
  }

  await startProxyServer(options.dist || process.cwd(), port, config);
};

async function loadConfig(options: ProxyOptions): Promise<ProxyServerConfig> {
  const config: ProxyServerConfig = {
    kits: [],
    proxy: [],
  };

  if (options.config == undefined) {
    throw new Error("You must specify a config file.");
  }

  const fileUrl = pathToFileURL(options.config);

  const importedConfig = JSON.parse(
    await readFile(fileUrl.pathname, { encoding: "utf-8" })
  ) as SimpleProxyServerConfig;

  if (importedConfig == undefined) {
    throw new Error("The config file must export a default object.");
  }

  if (importedConfig.kits == undefined || importedConfig.proxy == undefined) {
    throw new Error(
      "The config file must have at least one kit and one proxy property."
    );
  }

  config.kits = await loadKits(importedConfig.kits);

  if (importedConfig.proxy) {
    config.proxy = importedConfig.proxy;
  }
  return config;
}

async function loadKits(
  kits: SimpleProxyServerConfig["kits"]
): Promise<ProxyServerConfig["kits"]> {
  const loadedKits: ProxyServerConfig["kits"] = [];
  for (const kitDetail of kits) {
    const kitImport = await import(kitDetail);
    loadedKits.push(asRuntimeKit(kitImport.default));
  }
  return loadedKits;
}
