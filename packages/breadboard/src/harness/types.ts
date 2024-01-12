/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeProxyConfig } from "../remote/config.js";
import { LoadResponse } from "../remote/protocol.js";
import { AnyClientRunResult, ClientRunResult } from "../remote/run.js";
import {
  ErrorResponse,
  InputResponse,
  Kit,
  OutputResponse,
  OutputValues,
  ProbeMessage,
} from "../types.js";

/**
 * The board has been loaded
 */
export type LoadResult = {
  type: "load";
  data: LoadResponse;
};

/**
 * The board is asking for input
 */
export type InputResult = {
  type: "input";
  data: InputResponse;
};

/**
 * The board is sending output
 */
export type OutputResult = {
  type: "output";
  data: OutputResponse;
};

/**
 * Sent when the harness is asking for secret
 */
export type SecretResult = {
  type: "secret";
  data: { keys: string[] };
};

/**
 * Sent when the board run process reports an error
 */
export type ErrorResult = {
  type: "error";
  data: ErrorResponse;
};

/**
 * Sent when the board run finished
 */
export type EndResult = {
  type: "end";
  data: Record<string, never>;
};

export type AnyRunResult =
  | InputResult
  | OutputResult
  | SecretResult
  | ErrorResult
  | EndResult
  | ProbeMessage;

export type HarnessRunResult =
  | AnyClientRunResult
  | ClientRunResult<SecretResult>;

export interface Harness {
  load(): Promise<LoadResponse>;
  run(state?: string): AsyncGenerator<HarnessRunResult, void>;
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
   * The URL of the board to run.
   */
  url: string;
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
  /**
   * Specifies whether to output diagnostics information.
   * Defaults to `false`.
   */
  diagnostics?: boolean;
};
