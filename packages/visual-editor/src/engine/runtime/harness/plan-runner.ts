/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BreakpointSpec,
  GraphDescriptor,
  HarnessRunner,
  NodeIdentifier,
  NodeLifecycleState,
  NodeValue,
  OrchestrationPlan,
  OrchestratorState,
  Outcome,
  PlanNodeInfo,
  RunConfig,
  RunEventTarget,
} from "@breadboard-ai/types";

import { timestamp } from "@breadboard-ai/utils";
import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import { defaultInvokeNode } from "../run/node-invoker.js";
import type {
  ConfigProvider,
  NodeInvoker,
  PlanCreator,
} from "../../../engine/types.js";
import { createPlan as defaultCreatePlan } from "../static/create-plan.js";
import { Orchestrator } from "../static/orchestrator.js";
import {
  EdgeStateChangeEvent,
  NodeStateChangeEvent,
  PauseEvent,
  ResumeEvent,
  StartEvent,
} from "./events.js";
import { RunStateController } from "./run-state-controller.js";

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
  #controller: RunStateController | null = null;

  readonly config: RunConfig;
  readonly #planCreator: PlanCreator;
  readonly #invoker: NodeInvoker;
  readonly #configProvider: ConfigProvider | undefined;

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
    this.#orchestrator.reset();
    this.#createController();
    this.dispatchEvent(new StartEvent({ timestamp: timestamp() }));
    this.#controller!.preamble();
    await this.#controller!.run();
    // Clear the controller after the run completes so that a subsequent
    // start() creates a fresh controller rather than taking the restart()
    // path (which is intended only for resuming from breakpoints).
    this.#controller = null;
  }

  #createController() {
    if (this.#controller) return;
    const args: ConstructorParameters<typeof RunStateController> = [
      this.config,
      this.config.runner!,
      this.#orchestrator,
      this.breakpoints,
      {
        pause: () => {
          if (!this.#orchestrator.working) {
            this.dispatchEvent(
              new PauseEvent(false, { timestamp: timestamp() })
            );
          }
        },
        dispatch: (event: Event) => {
          this.dispatchEvent(event);
        },
      },
      this.#invoker,
    ];
    if (this.#configProvider) {
      args.push(this.#configProvider);
    }
    this.#controller = new RunStateController(...args);
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

  constructor(
    config: RunConfig,
    planCreator: PlanCreator = defaultCreatePlan,
    invoker: NodeInvoker = defaultInvokeNode,
    configProvider?: ConfigProvider
  ) {
    super();
    this.config = config;
    this.#planCreator = planCreator;
    this.#invoker = invoker;
    this.#configProvider = configProvider;
    if (!config.runner) {
      throw new Error(
        `Unable to initialize PlanRunner: RunConfig.runner is empty`
      );
    }
    this.#orchestrator = this.#createOrchestrator(config.runner);
  }

  #createOrchestrator(graph: GraphDescriptor) {
    const plan = this.#planCreator(graph);
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
