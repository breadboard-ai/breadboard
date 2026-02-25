/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreakpointSpec,
  GraphDescriptor,
  NodeHandlerContext,
  NodeIdentifier,
  Outcome,
  RunConfig,
  Task,
} from "@breadboard-ai/types";

import { ok, timestamp } from "@breadboard-ai/utils";
import type {
  NodeInvoker,
  ConfigProvider,
  RunEventSink,
} from "../../../engine/types.js";
import { Orchestrator } from "../static/orchestrator.js";
import {
  EndEvent,
  GraphEndEvent,
  GraphStartEvent,
  NodeEndEvent,
  NodeStartEvent,
  RunnerErrorEvent,
} from "./events.js";
import {
  augmentWithSkipOutputs,
  computeControlState,
  computeSkipOutputs,
} from "../../../utils/control.js";

import { getLatestConfig as defaultGetLatestConfig } from "./get-latest-config.js";

export { RunStateController };

type TaskStatus = "breakpoint" | "success";

class RunStateController {
  #stopControllers: Map<NodeIdentifier, AbortController> = new Map();
  #running = false;

  context: NodeHandlerContext;

  constructor(
    public readonly config: RunConfig,
    private graph: GraphDescriptor,
    private orchestrator: Orchestrator,
    public readonly breakpoints: Map<NodeIdentifier, BreakpointSpec>,
    private readonly eventSink: RunEventSink,
    private readonly invoker: NodeInvoker,
    private readonly configProvider: ConfigProvider = defaultGetLatestConfig
  ) {
    this.context = initializeNodeHandlerContext(this.config, () => {
      this.#stopControllers.forEach((controller) => {
        controller.abort();
      });
    });
  }

  error(error: { $error: string }): { $error: string } {
    this.eventSink.dispatch(
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

    const index = crypto.randomUUID();
    this.eventSink.dispatch(
      new NodeStartEvent({
        node: task.node,
        inputs: task.inputs,
        index,
        timestamp: timestamp(),
      })
    );
    const working = this.orchestrator.setWorking(task.node.id);
    if (!ok(working)) {
      console.warn(working.$error);
    }
    const signal = this.#getOrCreateStopController(task.node.id).signal;
    const nodeConfiguration = this.configProvider(
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
          await this.invoker(
            {
              ...context,
              signal,
              currentStep: task.node,
              currentGraph: this.graph,
            },
            task.node,
            { ...nodeConfiguration, ...controlState.adjustedInputs }
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
    this.eventSink.dispatch(
      new NodeEndEvent({
        node: task.node,
        inputs: task.inputs,
        outputs,
        index,
        newOpportunities: [],
        timestamp: timestamp(),
      })
    );
    return "success";
  }

  preamble(): NodeHandlerContext {
    const context = this.context;
    if (this.orchestrator.progress !== "initial") return context;
    this.eventSink.dispatch(
      new GraphStartEvent({
        graph: this.graph,
        graphId: "",
        timestamp: timestamp(),
      })
    );
    return context;
  }

  postamble() {
    if (this.orchestrator.progress !== "finished") return;
    if (this.orchestrator.failed) {
      // Dispatch error event so the SCA onError action can set run-level error.
      this.error({ $error: "A step encountered an error" });
    }

    this.eventSink.dispatch(
      new GraphEndEvent({
        timestamp: timestamp(),
      })
    );

    this.eventSink.dispatch(
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
          this.eventSink.pause();
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

  update(orchestrator: Orchestrator) {
    const oldOrchestrator = this.orchestrator;
    orchestrator.update(oldOrchestrator);
    this.orchestrator = orchestrator;
  }
}

function initializeNodeHandlerContext(
  config: RunConfig,
  onAbort: () => void
): NodeHandlerContext {
  const {
    signal,
    graphStore,
    fetchWithCreds,
    getProjectRunState,
    clientDeploymentConfiguration,
    flags,
  } = config;

  signal?.addEventListener("abort", onAbort);

  return {
    signal,
    graphStore,
    sandbox: config.sandbox,
    fetchWithCreds,
    getProjectRunState,
    clientDeploymentConfiguration,
    flags,
  };
}
