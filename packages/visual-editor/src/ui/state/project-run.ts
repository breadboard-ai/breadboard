/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AppScreenOutput,
  EditableGraph,
  ErrorObject,
  ErrorResponse,
  GraphDescriptor,
  HarnessRunner,
  InspectableGraph,
  NodeIdentifier,
  NodeLifecycleState,
  NodeMetadata,
  NodeRunState,
  Outcome,
  OutputValues,
  RunConfig,
  RunError,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  SimplifiedProjectRunState,
} from "@breadboard-ai/types";

import { err, ok } from "@breadboard-ai/utils";
import { Signal } from "signal-polyfill";
import { signal } from "signal-utils";
import { SignalSet } from "signal-utils/set";
import { StateEvent } from "../events/events.js";
import { getStepIcon } from "../utils/get-step-icon.js";
import { edgeToString } from "../utils/workspace.js";
import { ReactiveApp } from "./app.js";
import { ReactiveAppScreen } from "./app-screen.js";
import { ReactiveRendererRunState } from "./renderer-run-state.js";
import {
  ProjectRun,
  ProjectRunStatus,
  RendererRunState,
  StepEditor,
} from "./types.js";
import { decodeError, decodeErrorData } from "./utils/decode-error.js";

import { ActionTracker } from "../types/types.js";
import { computeControlState } from "../../runtime/control.js";

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
  const inspectable = graphStore.inspect(gettingMainGraph.result, "");
  if (!inspectable) {
    return error(`Can't inspect graph`);
  }
  const run = ReactiveProjectRun.createInert(inspectable);
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

class ReactiveProjectRun implements ProjectRun, SimplifiedProjectRunState {
  app: ReactiveApp = new ReactiveApp(this);


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
        errors.set(
          entry.node.id,
          decodeErrorData(this.actionTracker, errorResponse)
        );
      }
    });
    return errors;
  }

  @signal
  accessor status: ProjectRunStatus = "stopped";

  @signal
  accessor renderer: RendererRunState = new ReactiveRendererRunState();

  @signal
  get estimatedEntryCount() {
    return this.#inspectable?.nodes().length || 0;
  }

  @signal
  get progress() {
    if (this.estimatedEntryCount === 0) {
      return 0;
    }

    const completed = [...this.renderer.nodes.values()].filter(
      (node) => node.status === "succeeded" || node.status === "skipped"
    ).length;

    return completed / this.estimatedEntryCount;
  }


  @signal
  accessor #inspectable: InspectableGraph | undefined;

  #topologyChanged = new Signal.State({});

  // Path-to-id mapping for resolving parent screens for nested outputs
  #pathToId = new Map<string, NodeIdentifier>();

  @signal
  get finalOutput(): OutputValues | null {
    if (this.status !== "stopped") return null;

    return this.app.last?.last?.output || null;
  }


  /**
   * Not part of the public interface, but used by its children (like
   * StepList).
   */
  @signal
  accessor graph: GraphDescriptor | undefined;

  private constructor(
    private readonly stepEditor: StepEditor | undefined,
    private readonly actionTracker: ActionTracker | undefined,
    inspectable?: InspectableGraph,
    private readonly runner?: HarnessRunner,
    editable?: EditableGraph,
    signal?: AbortSignal
  ) {
    if (!inspectable) return;

    this.#inspectable = inspectable;
    this.graph = this.#inspectable?.raw();

    editable?.addEventListener("graphchange", (e) => {
      this.#inspectable = editable.inspect("");
      if (e.topologyChange) {
        this.#topologyChanged.set({});
        const newGraph = { ...e.graph };
        this.graph = newGraph;
        this.#updateRunner(newGraph);
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
      });
      runner.addEventListener("nodestart", this.#nodeStart.bind(this));
      runner.addEventListener("nodeend", this.#nodeEnd.bind(this));
      runner.addEventListener("graphstart", this.#graphStart.bind(this));
      runner.addEventListener("graphend", this.#graphEnd.bind(this));
      // Input handling is done by SCA, but output handling for app screens is here
      runner.addEventListener("output", this.#output.bind(this));
      runner.addEventListener("error", this.#error.bind(this));
      runner.addEventListener("resume", () => {
        this.status = "running";
      });
      runner.addEventListener("nodestatechange", (e) => {
        const { id, state, message } = e.data;
        if (state === "failed") {
          const errorMessage =
            decodeErrorData(this.actionTracker, message as ErrorObject) ??
            "Unknown error";
          this.renderer.nodes.set(id, {
            status: state,
            errorMessage: errorMessage.message,
          });
          return;
        }
        // Note: Console entry finalization is now handled by SCA
        this.renderer.nodes.set(id, { status: state });
      });
      runner.addEventListener("edgestatechange", (e) => {
        const { edges, state } = e.data;
        edges?.forEach((edge) => {
          const edgeId = edgeToString(edge);
          this.renderer.edges.set(edgeId, { status: state });
        });
      });

      this.#updateRunner(this.#inspectable!.mainGraphDescriptor());
    }
  }

  async #updateRunner(graph: GraphDescriptor) {
    const { runner } = this;
    if (!runner) return;

    await runner.updateGraph?.(graph);

    this.renderer.nodes.clear();

    runner.state?.forEach(({ state, outputs }, id) => {
      const status = toNodeRunState(
        this.actionTracker,
        state,
        outputs as OutputValues
      );
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
  }

  #graphStart(event: RunGraphStartEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    console.debug("Project Run: Graph Start");
    this.#fatalError = null;
    this.#pathToId.clear();
  }

  #graphEnd(event: RunGraphEndEvent) {
    const pathLength = event.data.path.length;

    if (pathLength > 0) return;

    console.debug("Project Run: Graph End");
  }

  #nodeStart(event: RunNodeStartEvent) {
    console.debug("Project Run: Node Start", event);
    const { path } = event.data;

    // Nested nodes are handled by SCA console logic
    if (path.length > 1) {
      return;
    }

    const id = event.data.node.id;
    const metadata = this.#nodeMetadata(id);

    // Register path-to-id mapping for top-level nodes
    // This is used to find parent screens for nested outputs
    this.#pathToId.set(this.#topLevelPath(path), id);

    this.renderer.nodes.set(id, { status: "working" });

    const controlState = computeControlState(event.data.inputs);
    if (controlState.skip) return;

    // Create app screen for this node
    const node = this.#inspectable?.nodeById(id);
    const outputSchema = node?.currentDescribe()?.outputSchema;
    const screen = new ReactiveAppScreen(metadata.title || "", outputSchema);
    this.app.screens.set(id, screen);
  }

  #nodeEnd(event: RunNodeEndEvent) {
    console.debug("Project Run: Node End", event);
    const { path } = event.data;

    // Nested nodes are handled by SCA console logic
    if (path.length > 1) {
      return;
    }

    const id = event.data.node.id;
    const nodeState = this.runner?.state?.get(id);

    if (nodeState) {
      if (nodeState.state === "failed") {
        const errorResponse = nodeState.outputs?.$error as
          | ErrorResponse
          | undefined;
        if (errorResponse) {
          const error = decodeErrorData(this.actionTracker, errorResponse);
          this.renderer.nodes.set(id, {
            status: "failed",
            errorMessage: error.details || error.message,
          });
        }
      } else if (nodeState.state === "interrupted") {
        this.app.screens.delete(id);
      } else {
        this.renderer.nodes.set(id, { status: "succeeded" });
      }
    }

    this.app.screens.get(id)?.finalize(event.data);
  }

  #output(event: RunOutputEvent) {
    const { path, bubbled } = event.data;
    console.debug("Project Run: Output", event);

    // The non-bubbled outputs are not supported: they aren't found in the
    // new-style (A2-based) graphs.
    if (!bubbled) return;

    // Find the parent app screen using the path-to-id mapping
    // For top-level nodes, this is the node's own ID
    // For nested nodes, this finds the top-level parent
    const id = this.#getParentIdForPath(path);
    if (!id) {
      console.warn(`No parent app screen found for output at path [${path}]`);
      return;
    }

    // Add output to app screen for #renderOutputs()
    this.app.screens.get(id)?.addOutput(event.data);
  }

  /**
   * Converts a path to its top-level key (first element only).
   * This is used to find the parent app screen for nested events.
   */
  #topLevelPath(path: number[]): string {
    return path.toSpliced(1).join(",");
  }

  /**
   * Gets the parent node ID for a given path.
   * Returns null if no mapping exists.
   */
  #getParentIdForPath(path: number[]): NodeIdentifier | null {
    return this.#pathToId.get(this.#topLevelPath(path)) ?? null;
  }

  #error(event: RunErrorEvent) {
    const error = decodeError(this.actionTracker, event);
    this.#fatalError = error;
  }

  async handleUserAction(
    payload: StateEvent<"node.action">["payload"]
  ): Promise<Outcome<void>> {
    const saving = await this.stepEditor?.surface?.save();
    if (!ok(saving)) return saving;

    const { nodeId, actionContext } = payload;
    if (!actionContext) {
      console.warn(`Unknown action context`);
      return;
    }
    const runFromNode = actionContext === "graph";
    const nodeState = this.runner?.state?.get(nodeId);
    if (!nodeState) {
      console.warn(
        `Primary action: orchestrator state for node "${nodeId}" not found`
      );
      return;
    }
    switch (nodeState.state) {
      case "inactive": {
        break;
      }
      case "ready": {
        console.log(`Run node "${nodeId}"`, nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        run(runFromNode, nodeId, this.runner);
        break;
      }
      case "working": {
        console.log("Abort work", nodeState.state);
        this.renderer.nodes.set(nodeId, { status: "interrupted" });
        stop(nodeId, this.runner);
        break;
      }
      case "waiting": {
        console.log("Abort work", nodeState.state);
        // Input state is now handled by SCA
        this.renderer.nodes.set(nodeId, { status: "interrupted" });
        stop(nodeId, this.runner);
        break;
      }
      case "succeeded": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        run(runFromNode, nodeId, this.runner);
        break;
      }
      case "failed": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        run(runFromNode, nodeId, this.runner);
        break;
      }
      case "skipped": {
        console.warn(`Action event is invalid for "inactive" state`);
        break;
      }
      case "interrupted": {
        console.log("Run this node (again)", nodeState.state);
        this.#dismissedErrors.delete(nodeId);
        run(runFromNode, nodeId, this.runner);
        break;
      }
      default: {
        console.warn("Unknown state", nodeState.state);
      }
    }

    function stop(nodeId: NodeIdentifier, runner: HarnessRunner | undefined) {
      const stopping = runner?.stop?.(nodeId);
      if (!stopping) {
        console.log(`Runner does not support stopping`);
        return;
      }
      return stopping
        .then((outcome) => {
          if (!ok(outcome)) {
            console.warn(`Unable to stop`, outcome.$error);
          }
        })
        .catch((reason) => {
          console.warn("Exception thrown while stopping", reason);
        });
    }

    function run(
      runFromNode: boolean,
      nodeId: NodeIdentifier,
      runner: HarnessRunner | undefined
    ) {
      if (runFromNode) {
        runFrom(nodeId, runner);
      } else {
        runNode(nodeId, runner);
      }
    }

    function runFrom(
      nodeId: NodeIdentifier,
      runner: HarnessRunner | undefined
    ) {
      const running = runner?.runFrom?.(nodeId);
      if (!running) {
        console.log(`Runner does not support running from a node`);
        return;
      }
      running
        .then((outcome) => {
          if (!ok(outcome)) {
            console.warn(`Unable to run from node "${nodeId}"`, outcome.$error);
            return;
          }
        })
        .catch((reason) => {
          console.warn(
            `Exception thrown while running from node "${nodeId}"`,
            reason
          );
        });
    }

    function runNode(
      nodeId: NodeIdentifier,
      runner: HarnessRunner | undefined
    ) {
      const running = runner?.runNode?.(nodeId);
      if (!running) {
        console.log(`Runner does not support running individual nodes`);
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
  static createInert(inspectable: InspectableGraph) {
    return new ReactiveProjectRun(
      undefined,
      undefined,
      inspectable,
      undefined,
      undefined,
      undefined
    );
  }

  static create(
    stepEditor: StepEditor,
    actionTracker: ActionTracker,
    inspectable: InspectableGraph,
    runner: HarnessRunner,
    editable: EditableGraph | undefined,
    signal?: AbortSignal
  ) {
    return new ReactiveProjectRun(
      stepEditor,
      actionTracker,
      inspectable,
      runner,
      editable,
      signal
    );
  }
}

function toNodeRunState(
  actionTracker: ActionTracker | undefined,
  state: NodeLifecycleState,
  outputs: OutputValues | null
): Outcome<NodeRunState> {
  if (state === "failed") {
    if ("$error" in (outputs || {})) {
      const errorResponse = outputs?.$error as ErrorResponse | undefined;
      if (errorResponse) {
        const error = decodeErrorData(actionTracker, errorResponse);

        return {
          status: state,
          errorMessage: error.message,
        };
      }
    }
    return err(`Node in "failed" state, but outputs contain no error`);
  } else if (state === "interrupted") {
    return { status: state };
  }
  return { status: state };
}
