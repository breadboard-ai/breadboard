/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Kit, OutputValues } from "@google-labs/breadboard";
import type { NodeProxyConfig } from "@google-labs/breadboard/remote";

export interface Harness {
  run(url: string): AsyncGenerator<HarnessRunResult, void>;
}

export type Result = {
  id?: string;
  type: string;
  data: unknown;
};

export interface HarnessRunResult {
  reply(reply: unknown): void;
  message: Result;
}

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export type ProxyLocation = "main" | "worker" | "http";

export type HarnessProxyConfig = {
  location: ProxyLocation;
  url?: string;
  nodes: NodeProxyConfig;
};

export type HarnessRemoteConfig =
  | {
      /**
       * The type of the remote runtime. Can be "http" or "worker".
       * Currently, only "worker" is supported.
       */
      type: "http" | "worker";
      /**
       * The URL of the remote runtime. Specifies the URL of the worker
       * script if `type` is "worker", or the URL of the runtime server if
       * `type` is "http".
       */
      url: string;
    }
  | false;

export type HarnessConfig = {
  /**
   * The kits to use by the runtime.
   */
  kits: Kit[];
  /**
   * Specifies the remote environment in which to run the harness.
   * In this situation, the harness creates a runtime client, and relies
   * on the remote environment to act as the runtime server
   * If `remote` is not specified or is "false", this harness runs the board
   * itself, acting as a server (there is no need for a client).
   */
  remote?: HarnessRemoteConfig;
  /**
   * Specifies a list of node proxies to use. Each item specifies a proxy
   * server and a list of nodes that will be proxied to it.
   */
  proxy?: HarnessProxyConfig[];
};
