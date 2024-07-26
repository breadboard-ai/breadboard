/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DataStore } from "../data/types.js";
import type { GraphLoader } from "../loader/types.js";
import type { NodeProxyConfig } from "../remote/config.js";
import type {
  AnyClientRunResult,
  AnyProbeClientRunResult,
  ClientRunResult,
  ClientTransport,
  LoadResponse,
  ServerTransport,
} from "../remote/types.js";
import type {
  BreadboardRunner,
  ErrorResponse,
  InputResponse,
  InputValues,
  Kit,
  OutputResponse,
  OutputValues,
  RunState,
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
  data: { keys: string[]; timestamp: number };
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

export type HarnessRunResult =
  | AnyClientRunResult
  | ClientRunResult<SecretResult>;

export type HarnessProbeResult = AnyProbeClientRunResult;

export type SecretHandler = (keys: {
  keys?: string[];
}) => Promise<OutputValues>;

export type TransportFactory = {
  client<Request, Response>(label: string): ClientTransport<Request, Response>;
  server<Request, Response>(label: string): ServerTransport<Request, Response>;
};

export type HarnessRunner = AsyncGenerator<HarnessRunResult, void, unknown>;

export type ProxyLocation = "main" | "worker" | "http" | "python";

export type CustomProxyConfig = () => Promise<Kit>;

export type HarnessProxyConfig =
  | {
      location: ProxyLocation;
      url?: string;
      nodes: NodeProxyConfig;
    }
  | CustomProxyConfig;

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

export type RunConfig = {
  /**
   * The URL of the board to run.
   */
  url: string;
  /**
   * The base URL relative to which to load the board.
   * If ran in a browser, defaults to the current URL.
   * Otherwise, defaults to invoking module's URL.
   */
  base?: URL;
  /**
   * The kits to use by the runtime.
   */
  kits: Kit[];
  /**
   * The loader to use when loading boards.
   */
  loader?: GraphLoader;
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
  /**
   * Specifies a runner to use. This can be used instead of loading a board
   * from a URL.
   */
  runner?: BreadboardRunner;
  /**
   * The `AbortSignal` that can be used to stop the board run.
   */
  signal?: AbortSignal;
  /**
   * The values that will be supplied to the bubbled inputs during a board run.
   * This enables automatically providing some of the values like the model
   * name without interrupting the run of the board.
   */
  inputs?: InputValues;
  /**
   * Specifies whether or not secrets are asked for interactively. When `true`,
   * the `secret` result will start showing up in the run results whenever
   * the secret is asked for. Otherwise, the `secrets` node will try to find
   * the secrets on its own.
   */
  interactiveSecrets?: boolean;
  /**
   * The data store to use for storing data.
   */
  store?: DataStore;
  /**
   * The state from which to resume the run.
   */
  resumeFrom?: StateToResumeFrom;
};

export type StateToResumeFrom = {
  state: RunState;
  inputs?: InputValues;
};
