/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  NodeIdentifier,
  Outcome,
  OutputValues,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import {
  OrchestrationPlan,
  NodeLifecycleState,
  OrchestratorProgress,
  PlanNodeInfo,
  Task,
  OrchestrationNodeInfo,
} from "./types.js";

export { Orchestrator };

type NodeInternalState = {
  readonly plan: PlanNodeInfo;
  readonly stage: number;
  state: NodeLifecycleState;
  inputs: InputValues | null;
  outputs: OutputValues | null;
};

type OrchestratorState = Map<NodeIdentifier, NodeInternalState>;

const TERMINAL_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "succeeded",
  "failed",
  "skipped",
  "interrupted",
]);

const PROCESSING_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "ready",
  "working",
  "waiting",
]);

/**
 * The Orchestrator acts as the state machine for running a graph.
 * Its primary responsibilities are:
 *
 * 1.  Lifecycle Management: Starting, resetting, and managing the overall
 * progress of a run from beginning to end.
 * 2.  Task Coordination: Determining which nodes are ready to be invoked
 * based on dependencies.
 * 3.  State Persistence: Receiving results of node invocation and persisting
 * the state workflow.
 * 4.  Inspection and Debugging: Providing methods to observe the current state
 * of a run, inspect cached results, and control execution flow.
 *
 * It breaks down the process into three distinct parts:
 * - the planning -- determining the static sequence of a run
 * - the orchestration -- managing execution results that can be dynamic
 * - actual node invocation
 */
class Orchestrator {
  readonly #state: OrchestratorState = new Map();
  #currentStage: number = 0;
  #progress: OrchestratorProgress = "initial";

  constructor(public readonly plan: OrchestrationPlan) {
    this.reset();
  }

  /**
   * Returns current progress of the orchestration.
   */
  get progress() {
    return this.#progress;
  }

  /**
   * Bring the orchestrator to the initial state.
   */
  reset(): Outcome<void> {
    this.#state.clear();
    const state = this.#state;
    try {
      this.plan.stages.forEach((stage, index) => {
        const firstStage = index === 0;
        stage.forEach((plan: PlanNodeInfo) => {
          state.set(plan.node.id, {
            stage: index,
            state: firstStage ? "ready" : "inactive",
            plan,
            inputs: firstStage ? {} : null,
            outputs: null,
          });
        });
      });
    } catch (e) {
      return err((e as Error).message);
    }
    this.#currentStage = 0;
    this.#progress = "initial";
  }

  setWorking(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (!state) {
      return err(`Unable to set node "${id}" to working: node not found`);
    }
    if (!PROCESSING_STATES.has(state.state)) {
      return err(
        `Unable to set node "${id}" to working: not ready nor waiting`
      );
    }
    state.state = "working";
  }

  setWaiting(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (!state) {
      return err(`Unable to set node "${id}" to waiting: node not found`);
    }
    if (state.state !== "working") {
      return err(`Unable to set node "${id}" to waiting: not working`);
    }
    state.state = "waiting";
  }

  setInterrupted(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (!state) {
      return err(`Unable to set node "${id}" to interrupted: node not found`);
    }
    if (state.state !== "working" && state.state !== "waiting") {
      return err(
        `Unable to set node "${id}" to interrupted: not working or waiting`
      );
    }
    state.state = "interrupted";
    this.#propagateSkip(state);
  }

  /**
   * Provides a way to inspect the current state of nodes as they are being
   * orchestrated.
   * @returns a map representing current state of all nodes
   */
  state(): ReadonlyMap<NodeIdentifier, OrchestrationNodeInfo> {
    return new Map(
      Array.from(this.#state.entries()).map(([id, internal]) => {
        return [id, { node: internal.plan.node, state: internal.state }];
      })
    );
  }

  /**
   * Creates a list of current tasks: nodes to be invoked next, along
   * with their inputs, according to the current state of the orchestrator.
   */
  currentTasks(): Outcome<Task[]> {
    const tasks: Task[] = [];
    const stage = this.plan.stages[this.#currentStage];
    if (!stage) {
      return tasks;
    }
    try {
      stage.forEach((plan) => {
        const state = this.#state.get(plan.node.id);
        if (!state) {
          throw new Error(
            `While getting current tasks, node "${plan.node.id}" was not found`
          );
        }
        if (PROCESSING_STATES.has(state.state)) {
          tasks.push({ node: plan.node, inputs: state.inputs! });
        }
      });
      return tasks;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  #propagateSkip(state: NodeInternalState): Outcome<void> {
    try {
      // First, propagate the "skipped" state downstream to all descendants.
      const queue: NodeInternalState[] = [state];
      const visited: Set<NodeIdentifier> = new Set();
      while (queue.length > 0) {
        const current = queue.shift()!;
        current.plan.downstream.forEach((dep) => {
          const id = dep.to;
          if (visited.has(id)) return;
          const target = this.#state.get(id);
          if (!target) {
            throw new Error(
              `While trying to propagate skip downstream, failed to retrieve target state`
            );
          }
          if (!TERMINAL_STATES.has(target.state)) {
            queue.push(target);
            target.state = "skipped";
          }
          visited.add(id);
        });
      }
      // Then, propagate the "skipped" state through the graph, until we
      // reach quiescence.
      let changed = true;
      while (changed) {
        changed = false;
        this.#state.forEach((state) => {
          if (TERMINAL_STATES.has(state.state)) return;
          if (state.plan.downstream.length === 0) return;

          const allTerminal = state.plan.downstream.every((dep) => {
            const target = this.#state.get(dep.to);
            if (!target) {
              throw new Error(
                `While trying to settle state, failed to retrieve target state`
              );
            }
            return TERMINAL_STATES.has(target.state);
          });
          if (allTerminal) {
            state.state = "skipped";
            changed = true;
          }
        });
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }

  #tryAdvancingStage(): Outcome<OrchestratorProgress> {
    // Check to see if all other nodes at this stage have been invoked
    // (the state will be set to something other than "ready")
    const currentStage = this.plan.stages[this.#currentStage];
    if (!currentStage) {
      return err(
        `While trying to advance stage, failed to retrieve current stage`
      );
    }

    const complete = currentStage.every(
      (plan) => this.#state.get(plan.node.id)?.state !== "ready"
    );
    // Nope, still work to do.
    if (!complete) {
      this.#progress = "working";
      return this.#progress;
    }

    try {
      const nextStageIndex = this.#currentStage + 1;
      if (nextStageIndex > this.plan.stages.length - 1) {
        this.#progress = "finished";
        return this.#progress;
      }

      const stage = this.plan.stages[nextStageIndex];
      stage.forEach((info) => {
        const state = this.#state.get(info.node.id);
        if (!state) {
          throw new Error(
            `While trying to advance stage, failed to retrieve current state`
          );
        }
        const inputs: InputValues = {};
        let upstreamSkipped = false;
        info.upstream.forEach((dep) => {
          if (upstreamSkipped) return;

          const from = this.#state.get(dep.from);
          if (!from) {
            throw new Error(
              `While trying to advance stage, failed to retrieve upstream state`
            );
          }
          if (from.state === "inactive") {
            throw new Error(
              `While trying to advance stage, found node ${from.plan.node.id} with unresolved dependencies`
            );
          }
          if (from.state === "ready") {
            throw new Error(
              `While trying to advance stage, found node ${from.plan.node.id} what was not yet invoked`
            );
          }
          if (from.state === "skipped" || from.state === "failed") {
            upstreamSkipped = true;
            return;
          }
          const input = from.outputs?.[dep.out || ""];
          if (input && dep.in) {
            inputs[dep.in] = input;
          }
        });
        if (
          upstreamSkipped ||
          Object.keys(inputs).length !== info.upstream.length
        ) {
          // Either we were already skipped upstream or Some inputs were
          // missing, so we're going to mark this node as Skipped.
          state.state = "skipped";
          const propagating = this.#propagateSkip(state);
          if (!ok(propagating)) return propagating;
        } else {
          state.state = "ready";
          state.inputs = inputs;
        }
      });
      this.#currentStage = nextStageIndex;

      // Propagate outputs from the current stage as inputs for the next stage.
      this.#progress = "advanced";
      return this.#progress;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  /**
   * Submit results of a node invocation. Also updates the current state.
   */
  provideOutputs(
    id: NodeIdentifier,
    outputs: OutputValues
  ): Outcome<OrchestratorProgress> {
    const state = this.#state.get(id);
    if (!state) {
      return err(
        `While providing outputs, couldn't get state for node "${id}"`
      );
    }
    if (state.stage !== this.#currentStage) {
      return err(`Can't provide outputs outside of the current stage`);
    }
    if (state.state === "waiting") {
      return err(`Can't pfovide outputs while the node is waiting for input`);
    }
    // Update state of the node.
    state.outputs = outputs;
    if ("$error" in outputs) {
      state.state = "failed";
      const propagating = this.#propagateSkip(state);
      if (!ok(propagating)) return propagating;
    } else {
      state.state = "succeeded";
    }
    let progress;
    for (;;) {
      progress = this.#tryAdvancingStage();
      if (!ok(progress)) return progress;
      if (progress === "finished") return progress;

      const hasWork = this.currentTasks();
      if (!ok(hasWork)) return hasWork;

      if (hasWork.length > 0) break;
    }
    return progress;
  }
}
