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
  Probe,
  ProbeMessage,
  RunConfig,
  Task,
} from "@breadboard-ai/types";

import { ok, timestamp } from "@breadboard-ai/utils";
import type { NodeInvoker } from "../../../engine/types.js";
import { Orchestrator } from "../static/orchestrator.js";
import {
  EndEvent,
  GraphEndEvent,
  GraphStartEvent,
  NodeEndEvent,
  NodeStartEvent,
  RunnerErrorEvent,
  SkipEvent,
} from "./events.js";
import {
  augmentWithSkipOutputs,
  computeControlState,
  computeSkipOutputs,
} from "../../../runtime/control.js";
import { assetsFromGraphDescriptor } from "../../../data/file-system.js";
import { getLatestConfig } from "./get-latest-config.js";

export { RunStateController };

type TaskStatus = "breakpoint" | "success";

class RunStateController {
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
    public readonly dispatch: (event: Event) => void,
    private readonly invoker: NodeInvoker
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
          await this.invoker.invokeNode(
            {
              ...context,
              fileSystem,
              signal,
              currentStep: task.node,
              currentGraph: this.graph,
            },
            { graph: this.graph },
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
