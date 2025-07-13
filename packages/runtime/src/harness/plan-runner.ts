/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  HarnessRunResult,
  NodeHandlerContext,
  NodeIdentifier,
  Outcome,
  Probe,
  RunConfig,
  TraversalResult,
} from "@breadboard-ai/types";
import { configureKits } from "./run.js";
import { fromProbe, fromRunnerResult, graphToRunFromConfig } from "./local.js";
import { resolveGraph, resolveGraphUrls } from "@breadboard-ai/loader";
import {
  asyncGen,
  err,
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
  #controller: InternalRunStateController | null = null;

  constructor(
    config: RunConfig,
    public readonly interactiveMode: boolean
  ) {
    super(config);
  }

  async next(): Promise<void> {
    return this.#controller?.runNextNode();
  }

  async continue(): Promise<void> {
    return this.#controller?.run();
  }

  async rerun(id: NodeIdentifier | null = null): Promise<void> {
    this.#controller?.rerun(id);
  }

  async state() {
    return (await this.#controller?.state)?.orchestrator.state();
  }

  protected async *getGenerator(): AsyncGenerator<
    HarnessRunResult,
    void,
    unknown
  > {
    yield* asyncGen<HarnessRunResult>(async (next) => {
      this.#controller = new InternalRunStateController(this.config, next);
      if (!this.interactiveMode) {
        await this.#controller.run();
        this.#controller = null;
      } else {
        await this.#controller.runInteractively();
        this.#controller = null;
      }
    });
  }
}

type InternalRunState = {
  graph: GraphDescriptor;
  plan: OrchestrationPlan;
  orchestrator: Orchestrator;
  context: NodeHandlerContext;
  last: NodeIdentifier | null;
};

class InternalRunStateController {
  state: Promise<InternalRunState>;
  index: number = 0;
  #finished: null | (() => void) = null;

  constructor(
    public readonly config: RunConfig,
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

    state.last = task.node.id;
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

  async run() {
    const state = await this.preamble();
    const runTask = this.runTask.bind(this);
    for (;;) {
      if (state.orchestrator.progress === "finished") break;

      const tasks = state.orchestrator.currentTasks();
      if (!ok(tasks)) {
        await this.error(tasks);
        return;
      }

      await Promise.all(tasks.map(runTask));
    }
    await this.postamble();
  }

  async rerun(id: NodeIdentifier | null = null): Promise<Outcome<void>> {
    const state = await this.state;
    const nodeId = id || state.last;
    if (!nodeId) {
      return err(`Unable to re-run: no last node and no node id provided`);
    }
    state.orchestrator.restartAtNode(nodeId);
    const running = await this.runNextNode();
    if (!ok(running)) return running;
    await this.postamble();
  }

  async runNextNode() {
    const state = await this.preamble();
    const tasks = state.orchestrator.currentTasks();
    if (!ok(tasks)) {
      await this.error(tasks);
      return;
    }
    const task = tasks[0];
    if (task) {
      await this.runTask(task);
    }
    await this.postamble();
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

    return { graph, context, plan, orchestrator, last: null };
  }
}
