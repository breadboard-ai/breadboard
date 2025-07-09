import {
  GraphDescriptor,
  HarnessRunResult,
  NodeHandlerContext,
  RunConfig,
  TraversalResult,
} from "@breadboard-ai/types";
import { configureKits } from "./run.js";
import { fromRunnerResult, graphToRunFromConfig } from "./local.js";
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
      inputs: task.inputs,
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

  async run() {
    const state = await this.state;
    let finished = false;
    for (;;) {
      if (finished) break;

      const tasks = state.orchestrator.currentTasks();
      if (!ok(tasks)) {
        this.error(tasks);
        return;
      }

      await Promise.all(
        tasks.map(async (task) => {
          const invoker = new NodeInvoker(
            state.context,
            { graph: state.graph },
            async (result) => this.callback(fromRunnerResult(result))
          );
          const outputs = await invoker.invokeNode(
            this.fromTask(task),
            this.path()
          );
          const progress = state.orchestrator.provideOutputs(
            task.node.id,
            outputs
          );
          if (progress === "finished") {
            finished = true;
          }
        })
      );
    }
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

    const probe = undefined;

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
