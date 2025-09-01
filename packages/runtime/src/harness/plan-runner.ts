/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { resolveGraph, resolveGraphUrls } from "@breadboard-ai/loader";
import {
  BreakpointSpec,
  GraphDescriptor,
  HarnessRunResult,
  NodeConfiguration,
  NodeHandlerContext,
  NodeIdentifier,
  NodeLifecycleState,
  OrchestrationPlan,
  OrchestratorState,
  Outcome,
  Probe,
  RunConfig,
  Task,
  TraversalResult,
} from "@breadboard-ai/types";
import {
  asyncGen,
  err,
  isImperativeGraph,
  ok,
  timestamp,
  toDeclarativeGraph,
} from "@breadboard-ai/utils";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { NodeInvoker } from "../run/node-invoker.js";
import { createPlan } from "../static/create-plan.js";
import { Orchestrator } from "../static/orchestrator.js";
import { AbstractRunner } from "./abstract-runner.js";
import { fromProbe, fromRunnerResult, graphToRunFromConfig } from "./local.js";
import { configureKits } from "./run.js";
import { NodeStateChangeEvent, PauseEvent, ResumeEvent } from "./events.js";

export { PlanRunner };

function emptyPlan(): OrchestrationPlan {
  return { stages: [] };
}

function emptyOrchestratorState(): OrchestratorState {
  return new Map();
}

class PlanRunner extends AbstractRunner {
  #controller: InternalRunStateController | null = null;

  @signal
  accessor #orchestrator: Orchestrator | null = null;

  @signal
  get state(): OrchestratorState {
    const runState = this.#runState;
    if (!runState) {
      if (this.#orchestrator) {
        return this.#orchestrator.fullState();
      }
      return emptyOrchestratorState();
    }

    return runState.orchestrator.fullState();
  }

  @signal
  get plan() {
    const runState = this.#runState;
    if (!runState) {
      if (this.#orchestrator) {
        return this.#orchestrator.plan;
      }
      return emptyPlan();
    }
    return runState.orchestrator.plan;
  }

  @signal
  accessor #runState: InternalRunState | undefined = undefined;

  accessor breakpoints = new SignalMap<NodeIdentifier, BreakpointSpec>();

  constructor(config: RunConfig) {
    super(config);
    if (config.runner) {
      // We have a GraphDescriptor, we can create plan/orchestrator
      // synchronously.
      this.#orchestrator = this.#createOrchestrator(config.runner);
    }
  }

  #createOrchestrator(graph: GraphDescriptor) {
    const plan = createPlan(graph);
    return new Orchestrator(plan, {
      stateChangedbyOrchestrator: (id, newState) => {
        this.#dispatchNodeStateChangeEvent(id, newState);
      },
    });
  }

  #dispatchNodeStateChangeEvent(id: NodeIdentifier, state: NodeLifecycleState) {
    this.dispatchEvent(new NodeStateChangeEvent({ id, state }));
  }

  async runNode(id: NodeIdentifier): Promise<Outcome<void>> {
    if (!this.#controller) {
      // First, activate the run
      this.run(undefined, true);
    }
    this.dispatchEvent(new ResumeEvent({ timestamp: timestamp() }));
    const outcome = await this.#controller?.runNode(id);
    this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
    return outcome;
  }

  async stop(id: NodeIdentifier): Promise<Outcome<void>> {
    const outcome = this.#controller?.stop(id);
    this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
    return outcome;
  }

  protected async *getGenerator(
    interactiveMode = false
  ): AsyncGenerator<HarnessRunResult, void, unknown> {
    this.#controller = null;

    yield* asyncGen<HarnessRunResult>(async (next) => {
      this.#controller = new InternalRunStateController(
        this.config,
        this.#orchestrator,
        this.breakpoints,
        () => {
          this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
        },
        next
      );
      this.#runState = await this.#controller.state;
      if (!interactiveMode) {
        // Start the first run.
        await this.#controller.run();
      }
      // Return a promise that never resolves, since plan runner can run
      // nodes even after the first run completes.
      return new Promise((resolve) => {
        this.config.signal?.addEventListener("abort", () => {
          resolve();
        });
      });
    });
  }

  updateGraph(graph: GraphDescriptor) {
    this.#orchestrator = this.#createOrchestrator(graph);
  }
}

type InternalRunState = {
  graph: GraphDescriptor;
  orchestrator: Orchestrator;
  context: NodeHandlerContext;
  last: NodeIdentifier | null;
};

type TaskStatus = "breakpoint" | "success";

class InternalRunStateController {
  #stopControllers: Map<NodeIdentifier, AbortController> = new Map();

  state: Promise<InternalRunState>;

  index: number = 0;
  #finished: null | (() => void) = null;

  constructor(
    public readonly config: RunConfig,
    public orchestrator: Orchestrator | null,
    public readonly breakpoints: Map<NodeIdentifier, BreakpointSpec>,
    public readonly pause: () => void,
    public readonly callback: (data: HarnessRunResult) => Promise<void>
  ) {
    this.state = this.initialize(callback);
  }

  path(): number[] {
    return [this.index++];
  }

  async error(error: { $error: string }): Promise<{ $error: string }> {
    await this.callback({
      type: "error",
      data: {
        error: error.$error,
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    return error;
  }

  fromTask(task: Task, config: NodeConfiguration): TraversalResult {
    // This is probably wrong, dig in later.
    return {
      descriptor: task.node,
      inputs: { ...config, ...task.inputs },
      missingInputs: [],
      current: { from: "", to: "" },
      opportunities: [],
      newOpportunities: [],
      partialOutputs: {},
      state: {
        state: new Map(),
        constants: new Map(),
        wireOutputs: () => {},
        getAvailableInputs: () => ({}),
        useInputs: () => {},
      },
      skip: false,
    };
  }

  async runTask(task: Task): Promise<TaskStatus> {
    const state = await this.state;

    const id = task.node.id;

    const breakpoint = this.breakpoints.get(id);
    if (breakpoint) {
      if (breakpoint.once) {
        this.breakpoints.delete(id);
      }
      return "breakpoint";
    }

    state.last = id;
    const path = this.path();
    this.callback({
      type: "nodestart",
      data: {
        node: task.node,
        inputs: task.inputs,
        path,
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    const working = state.orchestrator.setWorking(task.node.id);
    if (!ok(working)) {
      console.warn(working.$error);
    }
    const signal = this.#getOrCreateStopController(task.node.id).signal;
    const invoker = new NodeInvoker(
      { ...state.context, signal },
      { graph: state.graph },
      async (result) => {
        const harnessResult = fromRunnerResult(result);
        if (harnessResult.type === "input" && harnessResult.data.bubbled) {
          state.orchestrator.setWaiting(task.node.id);
          return this.callback({
            ...harnessResult,
            reply: async (inputs) => {
              state.orchestrator.setWorking(task.node.id);
              return harnessResult.reply(inputs);
            },
          });
        }
        return this.callback(harnessResult);
      }
    );
    const nodeConfiguration = getLatestConfig(task.node.id, state);
    let outputs;
    if (!ok(nodeConfiguration)) {
      outputs = nodeConfiguration as { $error: string };
      console.warn(`Can't get latest config`, outputs.$error);
    } else {
      outputs = await invoker.invokeNode(
        this.fromTask(task, nodeConfiguration),
        path
      );
      if (signal.aborted) {
        const interrupting = state.orchestrator.setInterrupted(task.node.id);
        if (!ok(interrupting)) {
          console.warn(interrupting.$error);
        }
      } else {
        const working = state.orchestrator.setWorking(task.node.id);
        if (!ok(working)) {
          console.warn(working.$error);
        }
        const providing = state.orchestrator.provideOutputs(
          task.node.id,
          outputs
        );
        if (!ok(providing)) {
          console.warn(providing.$error);
        }
      }
    }
    this.callback({
      type: "nodeend",
      data: {
        node: task.node,
        inputs: task.inputs,
        outputs,
        path,
        newOpportunities: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    return "success";
  }

  async preamble(): Promise<InternalRunState> {
    const state = await this.state;
    if (state.orchestrator.progress !== "initial") return state;
    await this.callback({
      type: "graphstart",
      data: {
        graph: state.graph,
        graphId: "",
        path: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    return state;
  }

  async postamble() {
    const state = await this.state;
    if (state.orchestrator.progress !== "finished") return;
    await this.callback({
      type: "graphend",
      data: {
        path: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });

    await this.callback({
      type: "end",
      data: {
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    this.#finished?.();
    this.#finished = null;
  }

  async runInteractively(): Promise<void> {
    return new Promise((resolve) => {
      this.#finished = resolve;
    });
  }

  #getOrCreateStopController(id: NodeIdentifier) {
    let stopController = this.#stopControllers.get(id);
    if (stopController) return stopController;

    stopController = new AbortController();
    this.#stopControllers.set(id, stopController);
    return stopController;
  }

  async run() {
    const state = await this.preamble();
    for (;;) {
      if (state.orchestrator.progress === "finished") break;

      const tasks = state.orchestrator.currentTasks();
      if (!ok(tasks)) {
        await this.error(tasks);
        return;
      }
      if (tasks.length === 0) return;

      let breakpoint = false;
      await Promise.all(
        tasks.map(async (task) => {
          const status = await this.runTask(task);
          if (status === "breakpoint") {
            breakpoint = true;
          }
        })
      );
      if (breakpoint) {
        this.pause();
        break;
      }
    }
    await this.postamble();
  }

  async runNode(id: NodeIdentifier): Promise<Outcome<void>> {
    const state = await this.state;
    const task = state.orchestrator.taskFromId(id);
    if (!ok(task)) return task;
    await this.runTask(task);
  }

  async stop(id: NodeIdentifier) {
    const stopController = this.#stopControllers?.get(id);
    if (!stopController) {
      console.warn(`Unable to find stop controller for node "${id}"`);
      return;
    }
    try {
      stopController.abort(`Interrupt node "${id}"`);
    } catch (e) {
      console.log(e);
    }
    this.#stopControllers?.delete(id);
    const state = await this.state;
    state.orchestrator.setInterrupted(id);
  }

  async initializeNodeHandlerContext(
    next: (data: HarnessRunResult) => Promise<void>
  ): Promise<NodeHandlerContext> {
    const kits = await configureKits(this.config, next);

    const { loader, store, fileSystem, base, signal, state, graphStore } =
      this.config;

    const probe: Probe = {
      async report(message) {
        next(fromProbe(message));
      },
    };

    signal?.addEventListener("abort", () => {
      this.#stopControllers.forEach((controller) => {
        controller.abort();
      });
    });

    return {
      probe,
      kits,
      loader,
      store,
      fileSystem,
      base,
      signal,
      state,
      graphStore,
    };
  }

  async initialize(
    next: (data: HarnessRunResult) => Promise<void>
  ): Promise<InternalRunState> {
    let orchestrator;
    let graph;
    if (this.orchestrator) {
      graph = this.config.runner!;
      orchestrator = this.orchestrator;
    } else {
      const graphToRun = resolveGraphUrls(
        await graphToRunFromConfig(this.config)
      );
      graph = resolveGraph(graphToRun);

      if (isImperativeGraph(graph)) {
        graph = toDeclarativeGraph(graph);
      }

      const plan = createPlan(graph);
      orchestrator = new Orchestrator(plan, {
        stateChangedbyOrchestrator() {
          console.warn(
            'Unexpected invocation of "stateChangedbyOrchestrator" callback. Likely a bug somewhere.'
          );
        },
      });
    }

    const context = await this.initializeNodeHandlerContext(next);

    return { graph, context, orchestrator, last: null };
  }
}

function getLatestConfig(
  id: NodeIdentifier,
  state: InternalRunState
): Outcome<NodeConfiguration> {
  const gettingMainGraph = state.context.graphStore?.getByDescriptor(
    state.graph
  );
  if (!gettingMainGraph?.success) {
    return err(`Can't to find graph "${state.graph.url}" in graph store`);
  }
  const inspector = state.context.graphStore?.inspect(
    gettingMainGraph.result,
    ""
  );
  if (!inspector) {
    return err(`Can't get inspector for graph "${state.graph.url}"`);
  }
  const inspectableNode = inspector.nodeById(id);
  if (!inspectableNode) {
    return err(`Unable to find node "${id}`);
  }
  return inspectableNode?.configuration();
}
