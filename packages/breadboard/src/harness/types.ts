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
import { Kit, NodeDescriptor, OutputValues, ProbeMessage } from "../types.js";

export type AfterhandlerResponse = {
  node: NodeDescriptor;
  path: number[];
  outputs: OutputValues;
};

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
   * Sent before a handler for a particular node is invoked
   */
  | "beforehandler"
  /**
   * Sent after a handler for a particular node is invoked
   */
  | "afterhandler"
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
  | "end";

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
  data: { keys: string[] };
};

export type BeforehandlerResult = {
  type: "beforehandler";
  data: BeforehandlerResponse;
};

export type AfterhandlerResult = {
  type: "afterhandler";
  data: AfterhandlerResponse;
};

export type ErrorResult = {
  type: "error";
  data: { error: Error };
};

export type EndResult = {
  type: "end";
  data: Record<string, never>;
};

export type OptionalId = { id?: string };

export type AnyRunResult = (
  | InputResult
  | OutputResult
  | SecretResult
  | BeforehandlerResult
  | AfterhandlerResult
  | ErrorResult
  | EndResult
  | ProbeMessage
) &
  OptionalId;

export interface HarnessResult<R extends AnyRunResult> {
  reply(reply: unknown): void;
  message: R;
}

export type HarnessRunResult = HarnessResult<AnyRunResult>;

export interface Harness {
  load(): Promise<LoadResponse>;
  run(): AsyncGenerator<HarnessRunResult, void>;
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
