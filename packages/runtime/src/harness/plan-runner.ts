/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreakpointSpec,
  GraphDescriptor,
  HarnessRunResult,
  InputValues,
  NodeConfiguration,
  NodeHandlerContext,
  NodeIdentifier,
  NodeLifecycleState,
  NodeValue,
  OrchestrationPlan,
  OrchestratorState,
  Outcome,
  PlanNodeInfo,
  Probe,
  RunConfig,
  Task,
  TraversalResult,
} from "@breadboard-ai/types";
import { asyncGen, err, ok, timestamp } from "@breadboard-ai/utils";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { NodeInvoker } from "../run/node-invoker.js";
import { createPlan } from "../static/create-plan.js";
import { Orchestrator } from "../static/orchestrator.js";
import { AbstractRunner } from "./abstract-runner.js";
import {
  EdgeStateChangeEvent,
  NodeStateChangeEvent,
  PauseEvent,
  ResumeEvent,
} from "./events.js";
import { fromProbe, fromRunnerResult } from "./local.js";
import { configureKits } from "./run.js";

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
  accessor #orchestrator: Orchestrator;

  @signal
  get state(): OrchestratorState {
    const orchestrator = this.#orchestrator;
    if (orchestrator) {
      return orchestrator.fullState();
    }
    return emptyOrchestratorState();
  }

  @signal
  get plan() {
    const orchestrator = this.#orchestrator;
    if (orchestrator) {
      return orchestrator.plan;
    }
    return emptyPlan();
  }

  accessor breakpoints = new SignalMap<NodeIdentifier, BreakpointSpec>();

  constructor(config: RunConfig) {
    super(config);
    if (!config.runner) {
      throw new Error(
        `Unable to initialize PlanRunner: RunConfig.runner is empty`
      );
    }
    this.#orchestrator = this.#createOrchestrator(config.runner);
  }

  #createOrchestrator(graph: GraphDescriptor) {
    const plan = createPlan(graph);
    return new Orchestrator(plan, {
      stateChangedbyOrchestrator: (id, newState, message) => {
        this.#dispatchNodeStateChangeEvent(id, newState, message);
      },
      stateChanged: (newState, info) => {
        this.#updateEdgeState(newState, info);
      },
    });
  }

  #updateEdgeState(state: NodeLifecycleState, info: PlanNodeInfo) {
    switch (state) {
      case "inactive":
      case "skipped":
        this.dispatchEvent(
          new EdgeStateChangeEvent({ edges: info.downstream, state: "initial" })
        );
        break;
      case "working":
      case "waiting":
        this.dispatchEvent(
          new EdgeStateChangeEvent({ edges: info.upstream, state: "consumed" })
        );
        break;
      case "failed":
      case "interrupted":
        this.dispatchEvent(
          new EdgeStateChangeEvent({ edges: info.downstream, state: "initial" })
        );
        break;
      case "ready":
        break;
      case "succeeded":
        this.dispatchEvent(
          new EdgeStateChangeEvent({ edges: info.downstream, state: "stored" })
        );
        break;
    }
  }

  #dispatchNodeStateChangeEvent(
    id: NodeIdentifier,
    state: NodeLifecycleState,
    message?: NodeValue
  ) {
    this.dispatchEvent(new NodeStateChangeEvent({ id, state, message }));
  }

  async runNode(id: NodeIdentifier): Promise<Outcome<void>> {
    if (!this.#controller) {
      // First, activate the run
      this.run(undefined, true);
    }
    if (!this.#orchestrator.working) {
      this.dispatchEvent(new ResumeEvent({ timestamp: timestamp() }));
    }
    const outcome = await this.#controller?.runNode(id);
    if (!this.#orchestrator.working) {
      this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
    }
    return outcome;
  }

  async runFrom(id: NodeIdentifier): Promise<Outcome<void>> {
    if (!this.#controller) {
      // If not already running, start a run in interactive mode
      this.run(undefined, true);
    } else if (!this.#orchestrator.working) {
      this.dispatchEvent(new ResumeEvent({ timestamp: timestamp() }));
    }
    return this.#controller?.runFrom(id);
  }

  async stop(id: NodeIdentifier): Promise<Outcome<void>> {
    const outcome = this.#controller?.stop(id);
    if (!this.#orchestrator.working) {
      this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
    }
    return outcome;
  }

  protected async *getGenerator(
    interactiveMode = false
  ): AsyncGenerator<HarnessRunResult, void, unknown> {
    this.#controller = null;

    yield* asyncGen<HarnessRunResult>(async (next) => {
      this.#controller = new InternalRunStateController(
        this.config,
        this.config.runner!,
        this.#orchestrator,
        this.breakpoints,
        () => {
          if (!this.#orchestrator.working) {
            this.dispatchEvent(
              new PauseEvent(false, { timestamp: timestamp() })
            );
          }
        },
        (inputs) => {
          this.run(inputs);
        },
        next
      );
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

  async updateGraph(graph: GraphDescriptor) {
    if (this.#orchestrator.working) {
      this.#controller?.stopAll();
      this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
    }
    this.#orchestrator = this.#createOrchestrator(graph);
    if (this.#controller) {
      this.#controller.update(this.#orchestrator);
    }
  }
}

type TaskStatus = "breakpoint" | "success";

class InternalRunStateController {
  #stopControllers: Map<NodeIdentifier, AbortController> = new Map();

  context: Promise<NodeHandlerContext>;

  index: number = 0;

  constructor(
    public readonly config: RunConfig,
    private graph: GraphDescriptor,
    private orchestrator: Orchestrator,
    public readonly breakpoints: Map<NodeIdentifier, BreakpointSpec>,
    public readonly pause: () => void,
    public readonly resume: (inputs: InputValues) => void,
    public readonly callback: (data: HarnessRunResult) => Promise<void>
  ) {
    this.context = this.initializeNodeHandlerContext(callback);
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
    const context = await this.context;

    const id = task.node.id;

    const breakpoint = this.breakpoints.get(id);
    if (breakpoint) {
      if (breakpoint.once) {
        this.breakpoints.delete(id);
      }
      return "breakpoint";
    }

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
    const working = this.orchestrator.setWorking(task.node.id);
    if (!ok(working)) {
      console.warn(working.$error);
    }
    const signal = this.#getOrCreateStopController(task.node.id).signal;
    const invoker = new NodeInvoker(
      { ...context, signal },
      { graph: this.graph },
      async (result) => {
        const harnessResult = fromRunnerResult(result);
        if (harnessResult.type === "input" && harnessResult.data.bubbled) {
          signal.addEventListener("abort", () => {
            // We're doing something fairly hacky here: resuming from inside
            // of the runner. This is okay, since resuming will immediately
            // result in stopping (node marked as interrupted).
            this.resume({});
          });
          this.orchestrator.setWaiting(task.node.id);
          return this.callback({
            ...harnessResult,
            reply: async (inputs) => {
              if (!signal.aborted) {
                this.orchestrator.setWorking(task.node.id);
              }
              return harnessResult.reply(inputs);
            },
          });
        }
        return this.callback(harnessResult);
      }
    );
    const nodeConfiguration = getLatestConfig(
      task.node.id,
      this.graph,
      context
    );
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
        const interrupting = this.orchestrator.setInterrupted(task.node.id);
        if (!ok(interrupting)) {
          console.warn(interrupting.$error);
        }
      } else {
        const working = this.orchestrator.setWorking(task.node.id);
        if (!ok(working)) {
          console.warn(working.$error);
        }
        const providing = this.orchestrator.provideOutputs(
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

  async preamble(): Promise<NodeHandlerContext> {
    const context = await this.context;
    if (this.orchestrator.progress !== "initial") return context;
    await this.callback({
      type: "graphstart",
      data: {
        graph: this.graph,
        graphId: "",
        path: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    return context;
  }

  async postamble() {
    if (this.orchestrator.progress !== "finished") return;
    if (this.orchestrator.failed) {
      this.pause();
      return;
    }

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
  }

  #getOrCreateStopController(id: NodeIdentifier) {
    let stopController = this.#stopControllers.get(id);
    if (stopController) return stopController;

    stopController = new AbortController();
    this.#stopControllers.set(id, stopController);
    return stopController;
  }

  async run() {
    for (;;) {
      if (this.orchestrator.progress === "finished") break;

      const tasks = this.orchestrator.currentTasks();
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
        return;
      }
    }
    await this.postamble();
  }

  async runNode(id: NodeIdentifier): Promise<Outcome<void>> {
    const task = this.orchestrator.taskFromId(id);
    if (!ok(task)) return task;
    await this.runTask(task);
  }

  async runFrom(id: NodeIdentifier): Promise<Outcome<void>> {
    this.orchestrator.restartAtNode(id);
    return this.run();
  }

  stopAll() {
    [...this.#stopControllers.keys()].forEach((id) => {
      this.stop(id);
    });
  }

  stop(id: NodeIdentifier) {
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
    this.orchestrator.setInterrupted(id);
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

  update(orchestrator: Orchestrator) {
    const oldOrchestartor = this.orchestrator;
    orchestrator.update(oldOrchestartor);
    this.orchestrator = orchestrator;
  }
}

function getLatestConfig(
  id: NodeIdentifier,
  graph: GraphDescriptor,
  context: NodeHandlerContext
): Outcome<NodeConfiguration> {
  const gettingMainGraph = context.graphStore?.getByDescriptor(graph);
  if (!gettingMainGraph?.success) {
    return err(`Can't to find graph "${graph.url}" in graph store`);
  }
  const inspector = context.graphStore?.inspect(gettingMainGraph.result, "");
  if (!inspector) {
    return err(`Can't get inspector for graph "${graph.url}"`);
  }
  const inspectableNode = inspector.nodeById(id);
  if (!inspectableNode) {
    return err(`Unable to find node "${id}`);
  }
  return inspectableNode?.configuration();
}
