/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProxyClient } from "../remote/proxy.js";
import { Kit } from "../types.js";
import { TransportFactory } from "./types.js";

/**
 * The configuration for a proxy kit.
 */
export type ProxyKitConfig = {
  /**
   * The list of nodes to proxy.
   */
  proxy: string[] | undefined;
  location: string;
  transport: "worker" | "http";
};

export type KitConfig = Kit | ProxyKitConfig;

const isProxyKitConfig = (
  kitOrConfig: KitConfig
): kitOrConfig is ProxyKitConfig => {
  return "proxy" in kitOrConfig;
};

export const configureKits = (kits: KitConfig[], factory: TransportFactory) => {
  return kits.map((kit) => {
    if (isProxyKitConfig(kit)) {
      const proxyClient = new ProxyClient(factory.client("proxy"));
      return proxyClient.createProxyKit(kit.proxy);
    }
    return kit;
  });
};
