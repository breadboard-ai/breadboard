/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DataStore, FileSystem, Outcome } from "./data.js";
import { DeepReadonly } from "./deep-read-only.js";
import { RuntimeFlagManager } from "./flags.js";
import {
  Edge,
  GraphDescriptor,
  InputValues,
  NodeIdentifier,
  NodeValue,
  OutputValues,
} from "./graph-descriptor.js";
import { MutableGraphStore } from "./inspect.js";
import { GraphLoader } from "./loader.js";
import { ErrorResponse, Kit } from "./node-handler.js";
import {
  EdgeLifecycleState,
  NodeLifecycleState,
  OrchestrationPlan,
  OrchestratorNodeState,
  OrchestratorState,
} from "./orchestration.js";
import {
  GraphEndProbeData,
  GraphStartProbeData,
  NodeEndResponse,
  NodeStartResponse,
  SkipProbeMessage,
} from "./probe.js";
import {
  AnyClientRunResult,
  AnyProbeClientRunResult,
  ClientRunResult,
  End,
  InputResponse,
  LoadResponse,
  OutputResponse,
} from "./remote.js";
import { ManagedRunState } from "./run.js";
import { Schema } from "./schema.js";
import { TraversalResult } from "./traversal.js";
import {
  TypedEventTarget,
  TypedEventTargetType,
} from "./typed-event-target.js";

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
  data: SecretResponse;
};

export type SecretResponse = {
  keys: string[];
  timestamp: number;
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

export type ProxyLocation = "main" | "worker" | "http" | "python";

export type CustomProxyConfig = () => Promise<Kit>;

/**
 * The level of diagnostics to supply during the run.
 * If `true`, all probe events will be supplied.
 * If `"top"`, only the top-level probe events will be supplied.
 * If `"silent"`, not even errors will be reported. This is particularly
 * useful for sideboards.
 * If `false`, no probe events will be supplied.
 *
 * Defaults to `false`.
 */
export type RunDiagnosticsLevel = boolean | "top" | "silent";

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
   * Specifies whether to output diagnostics information.
   * Defaults to `false`.
   */
  diagnostics?: RunDiagnosticsLevel;
  /**
   * Specifies a runner to use. This can be used instead of loading a board
   * from a URL.
   */
  runner?: GraphDescriptor;
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
   *
   * When set to `"fallback"`, the secrets will be asked for interactively
   * only if the secrets node is not able to find the secrets on its own.
   */
  interactiveSecrets?: boolean | "fallback";
  /**
   * The data store to use for storing data.
   */
  store?: DataStore;
  /**
   * Graph Store: tracks all the graphs, changes to them, and their
   * dependencies.
   */
  graphStore?: MutableGraphStore;
  /**
   * The file system, provided as module capability.
   */
  fileSystem?: FileSystem;
  /**
   * A way to see and manage runtime flags.
   */
  flags?: RuntimeFlagManager;
  /**
   * The state from which to resume the run.
   */
  state?: ManagedRunState;
  /**
   * Start node for the run. This is useful for specifying a particular
   * node as the start of the run. If not provided, nodes without any incoming
   * edges will be used.
   */
  start?: NodeIdentifier;
  /**
   * The id of the node to stop the run after. In combination with `state`, can
   * be used to run parts of the board.
   * If not specified, runs the whole board.
   */
  stopAfter?: NodeIdentifier;
  /**
   * A fetch implementation that automatically handles auth credentials.
   */
  fetchWithCreds?: typeof globalThis.fetch;
};

export type RunEventMap = {
  start: RunLifecycleEvent;
  pause: RunLifecycleEvent;
  resume: RunLifecycleEvent;
  next: RunNextEvent;
  input: RunInputEvent;
  output: RunOutputEvent;
  secret: RunSecretEvent;
  error: RunErrorEvent;
  skip: RunSkipEvent;
  graphstart: RunGraphStartEvent;
  graphend: RunGraphEndEvent;
  nodestart: RunNodeStartEvent;
  nodeend: RunNodeEndEvent;
  end: RunEndEvent;
  nodestatechange: RunNodeStateChangeEvent;
  edgestatechange: RunEdgeStateChangeEvent;
};

export type RunLifecycleEvent = Event & {
  running: boolean;
  data: { timestamp: number; inputs?: InputValues };
};

export type RunNextEvent = Event & {
  data: HarnessRunResult | void;
};

export type RunInputEvent = Event & {
  data: InputResponse;
  running: boolean;
};

export type RunOutputEvent = Event & {
  data: OutputResponse;
  running: true;
};

export type RunSecretEvent = Event & {
  data: SecretResult["data"];
  running: boolean;
};

export type RunErrorEvent = Event & {
  data: ErrorResponse;
  running: false;
};

export type RunEndEvent = Event & {
  data: End;
  running: false;
};

export type RunSkipEvent = Event & {
  data: SkipProbeMessage["data"];
  running: true;
};

export type RunGraphStartEvent = Event & {
  data: GraphStartProbeData;
  running: true;
};

export type RunGraphEndEvent = Event & {
  data: GraphEndProbeData;
  running: true;
};

export type RunNodeStartEvent = Event & {
  data: NodeStartResponse;
  result?: TraversalResult;
  running: true;
};

export type RunNodeEndEvent = Event & {
  data: NodeEndResponse;
  running: true;
};

export type RunNodeStateChangeEvent = Event & {
  data: {
    id: NodeIdentifier;
    state: NodeLifecycleState;
    message: NodeValue;
  };
  running: true;
};

export type RunEdgeStateChangeEvent = Event & {
  data: { edges: Edge[]; state: EdgeLifecycleState };
  running: true;
};
export type RunEventTarget = TypedEventTarget<RunEventMap>;

export type HarnessObserver = {
  observe(result: HarnessRunResult): Promise<void>;
  resume?(): void;
};

export type HarnessRunner = TypedEventTargetType<RunEventMap> & {
  addObserver(observer: HarnessObserver): void;

  /**
   * Check if the runner is running or not.
   *
   * @returns -- true if the runner is currently running, or false otherwise.
   */
  running(): boolean;

  /**
   * A convenience method to get the secret keys that the runner is
   * waiting for. This information can also be obtained by listening to
   * the `secret` event.
   *
   * Returns null if the runner is not waiting for any secrets.
   *
   * @returns -- set of secret keys that the runner is waiting for, or null.
   */
  secretKeys(): string[] | null;

  /**
   * A convenience method to get the input schema that the runner is
   * waiting for. This information can also be obtained by listening to
   * the `input` event.
   *
   * Returns null if the runner is not waiting for any inputs.
   *
   * @returns -- the input schema that the runner is waiting for, or null.
   */
  inputSchema(): Schema | null;

  /**
   * Starts or resumes the running of the board.
   * If the runner is waiting for input, the input arguments will be used
   * to provide the input values.
   *
   * If the runner is done, it will return true. If the runner is waiting
   * for input or secret, it will return false.
   *
   * @param inputs -- input values to provide to the runner.
   * @param interactiveMode -- whether or not this call stops right after
   *    initialization, allowing to run in interactive mode.
   * @returns -- true if the runner is done, or false if it is waiting
   *             for input.
   */
  run(inputs?: InputValues, interactiveMode?: boolean): Promise<boolean>;

  /**
   * For new runtime only: the current plan for the run.
   */
  plan?: DeepReadonly<OrchestrationPlan>;

  /**
   * For new runtime only: the current state of the orchestrator.
   */
  state?: DeepReadonly<OrchestratorState>;

  /**
   * For new runtime only: current breakpoints
   */
  breakpoints?: Map<NodeIdentifier, BreakpointSpec>;

  /**
   * For new runtime only: run a single node and stop.
   */
  runNode?(id: NodeIdentifier): Promise<Outcome<void>>;
  /**
   * For new runtime only: run (restart if necessary) from node until
   * completion
   */
  runFrom?(id: NodeIdentifier): Promise<Outcome<void>>;

  /**
   * For new runtime only: stop the run
   */
  stop?(id: NodeIdentifier): Promise<Outcome<void>>;

  /**
   * For new runtime only: A way to dynamically update
   * the graph descriptor for a runner.
   *
   */
  updateGraph?(graph: GraphDescriptor): Promise<void>;

  /**
   * For new runtime only: A map of all steps that are currently waiting for
   * input.
   */
  waiting?: Map<string, OrchestratorNodeState>;
};

/**
 * Specifies a breakpoint
 */
export type BreakpointSpec = {
  /**
   * If true, the breakpoint will be removed as soon as it is reached, thus
   * only causing the runtime to stop once.
   * Otherwise, the breakpoint is persistent and will remain until explicitly
   * removed.
   */
  once?: boolean;
};
