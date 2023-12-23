/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeProxyConfig } from "../remote/config.js";
import {
  BeforehandlerResponse,
  InputPromiseResponse,
  LoadResponse,
  OutputResponse,
} from "../remote/protocol.js";
import { InputValues, Kit, OutputValues } from "../types.js";

export type ResultType =
  /**
   * The board has been loaded
   */
  | "load"
  /**
   * The board is asking for input
   */
  | "input"
  /**
   * The board is sending output
   */
  | "output"
  /**
   * Sent before a handler for a particular node is handled
   */
  | "beforehandler"
  /**
   * Sent when the harness is asking for secret
   */
  | "secret"
  /**
   * Sent when the board run process reports an error
   */
  | "error"
  /**
   * Sent when the board run finished
   */
  | "end"
  /**
   * Sent when the harness is shutting down
   */
  | "shutdown";

export type LoadResult = {
  type: "load";
  data: LoadResponse;
};

export type InputResult = {
  type: "input";
  data: InputPromiseResponse;
};

export type OutputResult = {
  type: "output";
  data: OutputResponse;
};

export type SecretResult = {
  type: "secret";
  data: InputValues;
};

export type BeforehandlerResult = {
  type: "beforehandler";
  data: BeforehandlerResponse;
};

export type ErrorResult = {
  type: "error";
  data: { error: Error };
};

export type EndResult = {
  type: "end";
  data: Record<string, never>;
};

export type ShutdownResult = {
  type: "shutdown";
  data: null;
};

export type AnyResult = (
  | LoadResult
  | InputResult
  | OutputResult
  | SecretResult
  | BeforehandlerResult
  | ErrorResult
  | EndResult
  | ShutdownResult
) & { id?: string };

export interface HarnessRunResult {
  reply(reply: unknown): void;
  message: AnyResult;
}

export interface Harness {
  run(url: string): AsyncGenerator<HarnessRunResult, void>;
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
