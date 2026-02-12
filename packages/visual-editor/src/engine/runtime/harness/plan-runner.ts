/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreakpointSpec,
  GraphDescriptor,
  HarnessRunner,
  NodeHandlerContext,
  NodeIdentifier,
  NodeLifecycleState,
  NodeValue,
  OrchestrationPlan,
  OrchestratorState,
  Outcome,
  PlanNodeInfo,
  Probe,
  ProbeMessage,
  RunConfig,
  RunEventTarget,
  Task,
} from "@breadboard-ai/types";

import { ok, timestamp } from "@breadboard-ai/utils";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { NodeInvoker } from "../run/node-invoker.js";
import { createPlan } from "../static/create-plan.js";
import { Orchestrator } from "../static/orchestrator.js";
import {
  EdgeStateChangeEvent,
  NodeStateChangeEvent,
  EndEvent,
  GraphEndEvent,
  GraphStartEvent,
  NodeEndEvent,
  NodeStartEvent,
  PauseEvent,
  ResumeEvent,
  RunnerErrorEvent,
  SkipEvent,
  StartEvent,
} from "./events.js";
import {
  augmentWithSkipOutputs,
  computeControlState,
  computeSkipOutputs,
} from "../../../runtime/control.js";
import { assetsFromGraphDescriptor } from "../../../data/file-system.js";
import { getLatestConfig } from "./get-latest-config.js";

export { PlanRunner };

function emptyPlan(): OrchestrationPlan {
  return { stages: [] };
}

function emptyOrchestratorState(): OrchestratorState {
  return new Map();
}

class PlanRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #controller: InternalRunStateController | null = null;

  readonly config: RunConfig;

  running() {
    return !!this.#controller;
  }

  async start(): Promise<void> {
    if (this.#controller) {
      // Already running — restart at current stage (e.g., "Start" clicked
      // while paused at a breakpoint).
      await this.#controller.restart();
      return;
    }
    this.#createController();
    this.dispatchEvent(new StartEvent({ timestamp: timestamp() }));
    await this.#controller!.run();
  }

  #createController() {
    if (this.#controller) return;
    this.#controller = new InternalRunStateController(
      this.config,
      this.config.runner!,
      this.#orchestrator,
      this.breakpoints,
      () => {
        if (!this.#orchestrator.working) {
          this.dispatchEvent(new PauseEvent(false, { timestamp: timestamp() }));
        }
      },
      (event: Event) => {
        this.dispatchEvent(event);
      }
    );
  }

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

  @signal
  get waiting() {
    const orchestrator = this.#orchestrator;
    if (!orchestrator) return new Map();
    return new Map(orchestrator.allWaiting);
  }

  accessor breakpoints = new SignalMap<NodeIdentifier, BreakpointSpec>();

  constructor(config: RunConfig) {
    super();
    this.config = config;
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
        this.dispatchEvent(
          new EdgeStateChangeEvent({ edges: info.downstream, state: "initial" })
        );
        break;
      case "skipped":
        this.dispatchEvent(
          new EdgeStateChangeEvent({
            edges: [...info.upstream, ...info.downstream],
            state: "initial",
          })
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
      this.#createController();
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
    this.#orchestrator.allWaiting.forEach(([id]) => {
      this.stop(id);
    });

    // Stop all nodes from later stages that are currently working
    const nodeStage = this.#orchestrator.getNodeState(id)?.stage;
    if (nodeStage !== undefined) {
      this.#orchestrator.allWorking.forEach(([id, workingNodeState]) => {
        if (workingNodeState.stage > nodeStage) {
          this.stop(id);
        }
      });
    }

    if (!this.#controller || !this.running()) {
      this.#createController();
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
  #running = false;

  context: NodeHandlerContext;

  index: number = 0;

  constructor(
    public readonly config: RunConfig,
    private graph: GraphDescriptor,
    private orchestrator: Orchestrator,
    public readonly breakpoints: Map<NodeIdentifier, BreakpointSpec>,
    public readonly pause: () => void,
    public readonly dispatch: (event: Event) => void
  ) {
    this.context = this.initializeNodeHandlerContext();
  }

  path(): number[] {
    return [this.index++];
  }

  error(error: { $error: string }): { $error: string } {
    this.dispatch(
      new RunnerErrorEvent({
        error: error.$error,
        timestamp: timestamp(),
      })
    );
    return error;
  }

  async runTask(task: Task): Promise<TaskStatus> {
    const context = this.context;

    const id = task.node.id;

    const breakpoint = this.breakpoints.get(id);
    if (breakpoint) {
      if (breakpoint.once) {
        this.breakpoints.delete(id);
      }
      return "breakpoint";
    }

    const path = this.path();
    this.dispatch(
      new NodeStartEvent({
        node: task.node,
        inputs: task.inputs,
        path,
        timestamp: timestamp(),
      })
    );
    const working = this.orchestrator.setWorking(task.node.id);
    if (!ok(working)) {
      console.warn(working.$error);
    }
    const signal = this.#getOrCreateStopController(task.node.id).signal;
    const fileSystem = context.fileSystem?.updateRunFileSystem({
      graphUrl: this.graph.url!,
      assets: assetsFromGraphDescriptor(this.graph),
      env: context.fileSystem.env(),
    });
    const invoker = new NodeInvoker(
      {
        ...context,
        fileSystem,
        signal,
        currentStep: task.node,
        currentGraph: this.graph,
      },
      { graph: this.graph }
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
      const controlState = computeControlState(task.inputs);
      if (controlState.skip) {
        outputs = computeSkipOutputs(nodeConfiguration);
      } else {
        outputs = augmentWithSkipOutputs(
          nodeConfiguration,
          await invoker.invokeNode(
            task.node,
            { ...nodeConfiguration, ...controlState.adjustedInputs },
            path
          )
        );
      }
      if (signal.aborted) {
        const interrupting = this.orchestrator.setInterrupted(task.node.id);
        if (!ok(interrupting)) {
          console.warn(interrupting.$error);
        }
      } else {
        const providing = this.orchestrator.provideOutputs(
          task.node.id,
          outputs
        );
        if (!ok(providing)) {
          console.warn(providing.$error);
        }
      }
    }
    this.dispatch(
      new NodeEndEvent({
        node: task.node,
        inputs: task.inputs,
        outputs,
        path,
        newOpportunities: [],
        timestamp: timestamp(),
      })
    );
    return "success";
  }

  preamble(): NodeHandlerContext {
    const context = this.context;
    if (this.orchestrator.progress !== "initial") return context;
    this.dispatch(
      new GraphStartEvent({
        graph: this.graph,
        graphId: "",
        path: [],
        timestamp: timestamp(),
      })
    );
    return context;
  }

  postamble() {
    if (this.orchestrator.progress !== "finished") return;
    if (this.orchestrator.failed) {
      this.pause();
      return;
    }

    this.dispatch(
      new GraphEndEvent({
        path: [],
        timestamp: timestamp(),
      })
    );

    this.dispatch(
      new EndEvent({
        timestamp: timestamp(),
      })
    );
  }

  #getOrCreateStopController(id: NodeIdentifier) {
    let stopController = this.#stopControllers.get(id);
    if (stopController) return stopController;

    stopController = new AbortController();
    this.#stopControllers.set(id, stopController);
    return stopController;
  }

  async run() {
    if (this.#running) return;
    this.#running = true;
    try {
      for (;;) {
        if (this.orchestrator.progress === "finished") break;

        const tasks = this.orchestrator.currentTasks();
        if (!ok(tasks)) {
          this.error(tasks);
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
      this.postamble();
    } finally {
      this.#running = false;
    }
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

  async restart(): Promise<Outcome<void>> {
    this.orchestrator.restartAtCurrentStage();
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

  initializeNodeHandlerContext(): NodeHandlerContext {
    const {
      loader,
      fileSystem,
      base,
      signal,
      graphStore,
      fetchWithCreds,
      getProjectRunState,
      clientDeploymentConfiguration,
      flags,
    } = this.config;

    const dispatch = this.dispatch;
    const probe: Probe = {
      async report(message: ProbeMessage) {
        dispatchProbeMessage(dispatch, message);
      },
    };

    signal?.addEventListener("abort", () => {
      this.#stopControllers.forEach((controller) => {
        controller.abort();
      });
    });

    return {
      probe,
      loader,
      fileSystem,
      base,
      signal,
      graphStore,
      sandbox: graphStore?.sandbox,
      fetchWithCreds,
      getProjectRunState,
      clientDeploymentConfiguration,
      flags,
    };
  }

  update(orchestrator: Orchestrator) {
    const oldOrchestrator = this.orchestrator;
    orchestrator.update(oldOrchestrator);
    this.orchestrator = orchestrator;
  }
}

function dispatchProbeMessage(
  dispatch: (event: Event) => void,
  message: ProbeMessage
) {
  switch (message.type) {
    case "nodestart":
      dispatch(new NodeStartEvent(structuredClone(message.data)));
      break;
    case "nodeend":
      dispatch(new NodeEndEvent(structuredClone(message.data)));
      break;
    case "graphstart":
      dispatch(new GraphStartEvent(structuredClone(message.data)));
      break;
    case "graphend":
      dispatch(new GraphEndEvent(structuredClone(message.data)));
      break;
    case "skip":
      dispatch(new SkipEvent(structuredClone(message.data)));
      break;
  }
}
