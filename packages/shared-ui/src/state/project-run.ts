/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ParticleTree, ParticleTreeImpl } from "@breadboard-ai/particles";
import {
  ErrorResponse,
  HarnessRunner,
  NodeIdentifier,
  NodeLifecycleState,
  NodeMetadata,
  NodeRunState,
  RunConfig,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  Schema,
} from "@breadboard-ai/types";
import {
  err,
  FileSystem,
  InspectableGraph,
  MainGraphIdentifier,
  MutableGraphStore,
  ok,
  Outcome,
  OutputValues,
} from "@google-labs/breadboard";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { SignalSet } from "signal-utils/set";
import { StateEvent } from "../events/events";
import { getStepIcon } from "../utils/get-step-icon";
import { ReactiveApp } from "./app";
import { ReactiveAppScreen } from "./app-screen";
import { getParticleStreamHandle, idFromPath } from "./common";
import { ReactiveConsoleEntry } from "./console-entry";
import { ReactiveRendererRunState } from "./renderer-run-state";
import {
  AppScreenOutput,
  ConsoleEntry,
  EphemeralParticleTree,
  ProjectRun,
  ProjectRunStatus,
  RendererRunState,
  RunError,
  UserInput,
} from "./types";
import { decodeError, decodeErrorData } from "./utils/decode-error";
import { ParticleOperationReader } from "./utils/particle-operation-reader";

export { createProjectRunStateFromFinalOutput, ReactiveProjectRun };

function createProjectRunStateFromFinalOutput(
  runConfig: RunConfig,
  output: OutputValues
): Outcome<ProjectRun> {
  const { graphStore, runner: graph } = runConfig;
  if (!graph) {
    return error(`Graph wasn't specified`);
  }
  if (!graphStore) {
    return error(`Graph store wasn't supplied`);
  }

  const gettingMainGraph = graphStore.getByDescriptor(graph);
  if (!gettingMainGraph?.success) {
    return error(`Can't to find graph in graph store`);
  }
  const run = ReactiveProjectRun.createInert(
    gettingMainGraph.result,
    graphStore
  );
  const last: AppScreenOutput = {
    output,
    schema: {},
  };
  const current = new ReactiveAppScreen("", undefined);
  current.outputs.set("final", last);
  run.app.screens.set("final", current);
  return run;
}

function error(msg: string) {
  const full = `Unable to create project run state: ${msg}`;
  console.error(full);
  return err(full);
}

class ReactiveProjectRun implements ProjectRun {
  app: ReactiveApp = new ReactiveApp();
  console: Map<string, ConsoleEntry> = new SignalMap();

  #dismissedErrors = new SignalSet<NodeIdentifier>();
  #seenErrors = new Set<NodeIdentifier>();

  @signal
  accessor #fatalError: RunError | null = null;

  @signal
  get error(): RunError | null {
    if (this.#fatalError) {
      return this.#fatalError;
    }
    const newErrors = new Map<string, RunError>();
    this.errors.forEach((error, nodeId) => {
      if (this.#dismissedErrors.has(nodeId)) return;
      newErrors.set(nodeId, error);
      this.#seenErrors.add(nodeId);
    });
    const errorCount = newErrors.size;
    if (errorCount > 1) {
      return {
        message: "Multiple errors have occurred",
        details: [...this.errors.values()]
          .map((value) => {
            return value.message;
          })
          .join("\n\n"),
      };
    } else if (errorCount == 1) {
      return newErrors.values().next().value!;
    }
    return null;
  }

  @signal
  get errors(): Map<string, RunError> {
    const errors = new Map<string, RunError>();
    this.runner?.state?.forEach((entry) => {
      if (entry.state === "failed") {
        const errorResponse = entry.outputs?.$error as
          | ErrorResponse
          | undefined;
        if (!errorResponse) return;
        errors.set(entry.node.id, decodeErrorData(errorResponse));
      }
    });
    return errors;
  }

  @signal
  accessor status: ProjectRunStatus = "stopped";

  /**
   * Currently active (unfinished) entries in console.
   */
  @signal
  accessor current: Map<string, ReactiveConsoleEntry> | null = null;

  @signal
  accessor renderer: RendererRunState = new ReactiveRendererRunState();

  @signal
  get estimatedEntryCount() {
    return Math.max(this.#inspectable?.nodes().length || 0, this.console.size);
  }

  @signal
  get progress() {
    if (this.estimatedEntryCount === 0) {
      return 0;
    }

    return this.console.size / this.estimatedEntryCount;
  }

  @signal
  get consoleState() {
    return this.console.size > 0 ? "entries" : "start";
  }

  @signal
  get runnable() {
    return this.#inspectable?.nodes().length !== 0;
  }

  @signal
  accessor input: UserInput | null = null;

  @signal
  accessor #inspectable: InspectableGraph | undefined;

  @signal
  get finalOutput(): OutputValues | null {
    if (this.status !== "stopped") return null;

    return this.app.current?.last?.output || null;
  }

  #idCache = new IdCache();

  private constructor(
    private readonly mainGraphId: MainGraphIdentifier,
    private readonly graphStore?: MutableGraphStore,
    private readonly fileSystem?: FileSystem,
    private readonly runner?: HarnessRunner,
    signal?: AbortSignal
  ) {
    if (!graphStore) return;

    this.#inspectable = this.graphStore?.inspect(this.mainGraphId, "");

    graphStore.addEventListener("update", (e) => {
      if (e.mainGraphId === this.mainGraphId) {
        this.#inspectable = this.graphStore?.inspect(this.mainGraphId, "");
      }
      if (e.topologyChange) {
        this.#updateRunner();
      }
    });

    if (signal) {
      signal.addEventListener("abort", this.#abort.bind(this));
    }
    if (runner) {
      runner.addEventListener("start", () => {
        this.status = "running";
      });
      runner.addEventListener("pause", () => {
        this.status = "paused";
      });
      runner.addEventListener("end", () => {
        this.status = "stopped";
        this.current = null;
        this.input = null;
      });
      runner.addEventListener("nodestart", this.#nodeStart.bind(this));
      runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
      runner.addEventListener("graphstart", this.#graphStart.bind(this));
      runner.addEventListener("graphend", this.#graphEnd.bind(this));
      runner.addEventListener("input", this.#input.bind(this));
      runner.addEventListener("output", this.#output.bind(this));
      runner.addEventListener("error", this.#error.bind(this));
      runner.addEventListener("resume", () => {
        this.status = "running";
      });
      runner.addEventListener("nodestatechange", (e) => {
        const { id, state } = e.data;
        if (state === "failed" || state === "interrupted") {
          console.warn(`Unexpected failed/interrupted state change`, id, state);
          return;
        }
        this.renderer.nodes.set(id, { status: state });
      });

      this.#updateRunner();
    }
  }

  #updateRunner() {
    const { runner } = this;
    if (!runner) return;

    runner.updateGraph?.(this.#inspectable!.mainGraphDescriptor());

    this.console.clear();
    this.renderer.nodes.clear();

    runner.state?.forEach(({ state, outputs }, id) => {
      const inspectableNode = this.#inspectable?.nodeById(id);
      if (!inspectableNode) {
        console.warn(`Unable to retrieve node information for node "${id}"`);
      } else {
        const { title = id, tags, icon } = this.#nodeMetadata(id);
        this.console.set(id, {
          title,
          tags,
          icon,
          work: new Map(),
          output: new Map(),
          completed: true,
          error: null,
          current: null,
        });
      }
      const status = toNodeRunState(state, outputs as OutputValues);
      if (!ok(status)) {
        console.warn(status.$error);
      } else {
        this.renderer.nodes.set(id, status);
      }
    });
  }

  #nodeMetadata(id: NodeIdentifier): NodeMetadata {
    const node = this.#inspectable?.nodeById(id);
    const metadata = node?.currentDescribe()?.metadata || {};
    const { icon: defaultIcon, tags } = metadata;
    const icon = getStepIcon(defaultIcon, node?.currentPorts()) || undefined;
    const title = node?.title();
    return { tags, icon, title };
  }

  #abort() {
    this.status = "stopped";
    this.current = null;
    this.input = null;
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    console.debug("Project Run: Graph Start");
    this.#idCache.clear();
    this.#fatalError = null;
    this.current = null;
    this.input = null; // can't be too cautious.
  }

  #graphEnd(event: RunGraphEndEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    this.input = null; // clean up just in case.

    // TOOD: Do we need to do anything here?
    console.debug("Project Run: Graph End", this.console);
  }

  #nodeStart(event: RunNodeStartEvent) {
    console.debug("Project Run: Node Start", event);
    const { path } = event.data;

    if (path.length > 1) {
      const id = this.#idCache.get(path);
      if (!ok(id)) {
        console.warn(id.$error);
        return;
      }
      this.current?.get(id)?.onNodeStart(event.data);
      return;
    }

    const id = event.data.node.id;
    const node = this.#inspectable?.nodeById(id);
    const metadata = this.#nodeMetadata(id);
    const outputSchema = node?.currentDescribe()?.outputSchema;
    const entry = new ReactiveConsoleEntry(
      this.fileSystem,
      metadata,
      outputSchema
    );
    this.#idCache.set(path, id);
    this.current ??= new SignalMap();
    this.current.set(id, entry);
    this.console.set(id, entry);

    this.renderer.nodes.set(id, { status: "working" });

    // This looks like duplication with the console logic above,
    // but it's a hedge toward the future where screens and console entries
    // might go out of sync.
    // See https://github.com/breadboard-ai/breadboard/wiki/Screens
    const screen = new ReactiveAppScreen(metadata.title || "", outputSchema);
    this.app.screens.set(id, screen);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    console.debug("Project Run: Node End", event);
    const { path } = event.data;
    const pathLength = path.length;
    const id = this.#idCache.get(path);
    if (!ok(id)) {
      console.warn(id.$error);
      return;
    }

    if (pathLength > 1) {
      this.current?.get(id)?.onNodeEnd(event.data, {
        completeInput: () => {
          this.input = null;
        },
      });
      return;
    }

    const entry = this.current?.get(id);
    if (!entry) {
      console.warn(`Node with id "${id}" not found`);
    } else {
      const nodeState = this.runner?.state?.get(id);
      if (nodeState) {
        if (nodeState.state === "failed") {
          const errorResponse = nodeState.outputs?.$error as
            | ErrorResponse
            | undefined;
          if (!errorResponse) return;
          const error = decodeErrorData(errorResponse);
          entry.error = error;
          this.renderer.nodes.set(id, {
            status: "failed",
            errorMessage: error.message,
          });
        } else if (nodeState.state !== "interrupted") {
          this.renderer.nodes.set(id, { status: "succeeded" });
        }
      }
      entry.finalize(event.data);
    }
    this.app.current?.finalize(event.data);
  }

  #input(event: RunInputEvent) {
    const { path } = event.data;
    console.debug("Project Run: Input", event);
    if (!this.current) {
      console.warn(`No current console entry found for input event`, event);
      return;
    }
    const id = this.#idCache.get(path);
    if (!ok(id)) {
      console.warn(id.$error);
      return;
    }
    const currentConsoleEntry = this.current.get(id);
    if (!currentConsoleEntry) {
      console.warn(`No current console entry found at path "${path}"`);
      return;
    }
    const currentScreen = this.app.screens.get(id);
    if (!currentScreen) {
      console.warn(`No current screen found at path "${path}"`);
    } else {
      // Bump it to the bottom of the list (last item = really current);
      this.app.screens?.delete(id);
      this.app.screens?.set(id, currentScreen);
    }
    this.current.delete(id);
    this.current.set(id, currentConsoleEntry);
    this.renderer.nodes.set(id, { status: "working" });
    currentConsoleEntry.addInput(event.data, {
      itemCreated: (item) => {
        currentScreen?.markAsInput();
        if (!item.schema) {
          console.warn(`Schema unavailable for input, skipping`, event.data);
          return;
        }
        this.input = {
          schema: item.schema,
        };
      },
    });
  }

  #output(event: RunOutputEvent) {
    const { path, bubbled, node, outputs } = event.data;
    console.debug("Project Run: Output", event);
    if (!this.current) {
      console.warn(`No current console entry for output event`, event);
      return;
    }

    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    const id = this.#idCache.get(path);
    if (!ok(id)) {
      console.warn(id.$error);
      return;
    }

    const { configuration = {} } = node;
    const { schema: s = {} } = configuration;

    const schema = s as Schema;

    let particleTree: EphemeralParticleTree | null = null;
    const particleStreamHandle = getParticleStreamHandle(schema, outputs);
    if (particleStreamHandle) {
      if (!this.fileSystem) {
        console.warn(
          `Particle stream "${particleStreamHandle}" provided, but file system is not available`
        );
      } else {
        particleTree = new EphemeralParticleTreeImpl(
          this.fileSystem,
          particleStreamHandle
        );
      }
    }

    this.current.get(id)?.addOutput(event.data, particleTree);
    if (!this.app.current) {
      console.warn(`No current screen for output event`, event);
      return;
    }
    this.app.screens.get(id)?.addOutput(event.data, particleTree);
  }

  #error(event: RunErrorEvent) {
    const error = decodeError(event);
    this.input = null;
    this.#fatalError = error;
  }

  async handleUserAction(
    payload: StateEvent<"node.action">["payload"]
  ): Promise<Outcome<void>> {
    const { action, nodeId } = payload;
    if (action !== "primary") {
      console.warn(`Unknown action type: "${action}`);
      return;
    }
    const nodeState = this.runner?.state?.get(nodeId);
    if (!nodeState) {
      console.warn(
        `Primary action: orchestrator state for node "${nodeId}" not found`
      );
      return;
    }
    switch (nodeState.state) {
      case "inactive": {
        if (toggleBreakpoint(this.runner)) {
          this.renderer.nodes.set(nodeId, { status: "breakpoint" });
        } else {
          this.renderer.nodes.set(nodeId, { status: "inactive" });
        }
        break;
      }
      case "ready": {
        console.log(`Run node "${nodeId}"`, nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        runNode(nodeId, this.runner);
        break;
      }
      case "working": {
        console.log("Abort work", nodeState.state);
        this.renderer.nodes.set(nodeId, {
          status: "interrupted",
          errorMessage: "Stopped by user",
        });
        stop(nodeId, this.runner);
        break;
      }
      case "waiting": {
        console.log("Abort work", nodeState.state);
        this.renderer.nodes.set(nodeId, {
          status: "interrupted",
          errorMessage: "Stopped by user",
        });
        stop(nodeId, this.runner);
        break;
      }
      case "succeeded": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        runNode(nodeId, this.runner);
        break;
      }
      case "failed": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        runNode(nodeId, this.runner);
        break;
      }
      case "skipped": {
        if (toggleBreakpoint(this.runner)) {
          this.renderer.nodes.set(nodeId, { status: "breakpoint" });
        } else {
          this.renderer.nodes.set(nodeId, { status: "skipped" });
        }
        break;
      }
      case "interrupted": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        runNode(nodeId, this.runner);
        break;
      }
      default: {
        console.warn("Unknown state", nodeState.state);
      }
    }

    function toggleBreakpoint(runner: HarnessRunner | undefined): boolean {
      const breakpoints = runner?.breakpoints;
      if (!breakpoints) {
        console.warn(`Primary action: runner does not support breakpoints`);
        return false;
      }
      const breakpoint = breakpoints.get(nodeId);
      if (breakpoint) {
        console.log("Remove one-time breakpoint");
        breakpoints.delete(nodeId);
        return false;
      } else {
        console.log("Insert one-time breakpoint");
        breakpoints.set(nodeId, { once: true });
        return true;
      }
    }

    function stop(nodeId: NodeIdentifier, runner: HarnessRunner | undefined) {
      const stopping = runner?.stop?.(nodeId);
      if (!stopping) {
        console.log(`Primary action: runner does not support stopping`);
        return;
      }
      stopping
        .then((outcome) => {
          if (!ok(outcome)) {
            console.warn(`Unable to stop`, outcome.$error);
          }
        })
        .catch((reason) => {
          console.warn("Exception thrown while stopping", reason);
        });
    }

    function runNode(
      nodeId: NodeIdentifier,
      runner: HarnessRunner | undefined
    ) {
      const running = runner?.runNode?.(nodeId);
      if (!running) {
        console.log(
          `Primary action: runner does not support running individual nodes`
        );
        return;
      }
      running
        .then((outcome) => {
          if (!ok(outcome)) {
            console.warn(`Unable to run node`, outcome.$error);
          }
        })
        .catch((reason) => {
          console.warn(`Exception thrown while running node`, reason);
        });
    }
  }

  dismissError(): void {
    this.#seenErrors.forEach((id) => {
      this.#dismissedErrors.add(id);
    });
    this.#seenErrors.clear();
  }

  /**
   * Creates an inert (incapable of running) instance of a ProjectRun.
   * This instance is useful for representing and inspecting the run that
   * hasn't yet started.
   */
  static createInert(
    mainGraphId: MainGraphIdentifier,
    graphStore: MutableGraphStore
  ) {
    return new ReactiveProjectRun(
      mainGraphId,
      graphStore,
      undefined,
      undefined,
      undefined
    );
  }

  static create(
    mainGraphId: MainGraphIdentifier,
    graphStore: MutableGraphStore,
    fileSystem: FileSystem,
    runner: HarnessRunner,
    signal?: AbortSignal
  ) {
    return new ReactiveProjectRun(
      mainGraphId,
      graphStore,
      fileSystem,
      runner,
      signal
    );
  }
}

class EphemeralParticleTreeImpl implements EphemeralParticleTree {
  public readonly tree: ParticleTree;

  @signal
  accessor done = false;

  constructor(fileSystem: FileSystem, path: string) {
    this.tree = new ParticleTreeImpl();
    this.#start(fileSystem, path);
  }

  async #start(fileSystem: FileSystem, path: string) {
    const reader = new ParticleOperationReader(fileSystem, path);
    for await (const operation of reader) {
      this.tree.apply(operation);
    }
    this.done = true;
  }
}

class IdCache {
  #pathToId = new Map<string, NodeIdentifier>();

  clear() {
    this.#pathToId.clear();
  }

  #topLevel(path: number[]) {
    return idFromPath(path.toSpliced(1));
  }

  get(path: number[]): Outcome<string> {
    const topLevelPath = this.#topLevel(path);
    const id = this.#pathToId.get(topLevelPath);
    if (!id) {
      return err(`Could not find node id for path "${topLevelPath}"`);
    }
    return id;
  }

  set(path: number[], id: NodeIdentifier) {
    this.#pathToId.set(this.#topLevel(path), id);
  }
}

function toNodeRunState(
  state: NodeLifecycleState,
  outputs: OutputValues | null
): Outcome<NodeRunState> {
  if (state === "failed") {
    if ("$error" in (outputs || {})) {
      const errorResponse = outputs?.$error as ErrorResponse | undefined;
      if (errorResponse) {
        const error = decodeErrorData(errorResponse);

        return {
          status: state,
          errorMessage: error.message,
        };
      }
    }
    return err(`Node in "failed" state, but outputs contain no error`);
  } else if (state === "interrupted") {
    return {
      status: state,
      errorMessage: "Stopped by user",
    };
  }
  return { status: state };
}
