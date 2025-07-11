/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  HarnessRunResult,
  NodeHandlerContext,
  Probe,
  RunConfig,
  TraversalResult,
} from "@breadboard-ai/types";
import { configureKits } from "./run.js";
import { fromProbe, fromRunnerResult, graphToRunFromConfig } from "./local.js";
import { resolveGraph, resolveGraphUrls } from "@breadboard-ai/loader";
import {
  asyncGen,
  isImperativeGraph,
  ok,
  timestamp,
  toDeclarativeGraph,
} from "@breadboard-ai/utils";
import { createPlan } from "../static/create-plan.js";
import { Orchestrator } from "../static/orchestrator.js";
import { OrchestrationPlan, Task } from "../static/types.js";
import { NodeInvoker } from "../run/node-invoker.js";
import { AbstractRunner } from "./abstract-runner.js";

export { PlanRunner };

class PlanRunner extends AbstractRunner {
  protected async *getGenerator(): AsyncGenerator<
    HarnessRunResult,
    void,
    unknown
  > {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      const controller = new InternalRunStateController(this.config, next);
      return controller.run();
    });
  }
}

type InternalRunState = {
  graph: GraphDescriptor;
  plan: OrchestrationPlan;
  orchestrator: Orchestrator;
  context: NodeHandlerContext;
};

class InternalRunStateController {
  state: Promise<InternalRunState>;
  index: number = 0;

  constructor(
    public readonly config: RunConfig,
    public readonly callback: (data: HarnessRunResult) => Promise<void>
  ) {
    this.state = this.initialize(callback);
  }

  path(): number[] {
    return [this.index++];
  }

  error(error: { $error: string }): { $error: string } {
    this.callback({
      type: "error",
      data: {
        error: error.$error,
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    return error;
  }

  fromTask(task: Task): TraversalResult {
    // This is probably wrong, dig in later.
    return {
      descriptor: task.node,
      inputs: { ...task.node.configuration, ...task.inputs },
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

  async runTask(task: Task) {
    const state = await this.state;
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
    state.orchestrator.setWorking(task.node.id);
    const invoker = new NodeInvoker(
      state.context,
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
    const outputs = await invoker.invokeNode(this.fromTask(task), path);
    state.orchestrator.setWorking(task.node.id);
    state.orchestrator.provideOutputs(task.node.id, outputs);
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
  }

  async run() {
    const state = await this.state;
    this.callback({
      type: "graphstart",
      data: {
        graph: state.graph,
        graphId: "",
        path: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
    const runTask = this.runTask.bind(this);
    for (;;) {
      if (state.orchestrator.progress === "finished") break;

      const tasks = state.orchestrator.currentTasks();
      if (!ok(tasks)) {
        this.error(tasks);
        return;
      }

      await Promise.all(tasks.map(runTask));
    }

    this.callback({
      type: "graphend",
      data: {
        path: [],
        timestamp: timestamp(),
      },
      reply: async () => {},
    });

    this.callback({
      type: "end",
      data: {
        timestamp: timestamp(),
      },
      reply: async () => {},
    });
  }

  async initialize(
    next: (data: HarnessRunResult) => Promise<void>
  ): Promise<InternalRunState> {
    const kits = await configureKits(this.config, next);
    const graphToRun = resolveGraphUrls(
      await graphToRunFromConfig(this.config)
    );
    let graph = resolveGraph(graphToRun);

    if (isImperativeGraph(graph)) {
      graph = toDeclarativeGraph(graph);
    }
    const { loader, store, fileSystem, base, signal, state, graphStore } =
      this.config;

    const probe: Probe = {
      async report(message) {
        next(fromProbe(message));
      },
    };

    const context: NodeHandlerContext = {
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
    const plan = createPlan(graph);
    const orchestrator = new Orchestrator(plan);

    return { graph, context, plan, orchestrator };
  }
}
