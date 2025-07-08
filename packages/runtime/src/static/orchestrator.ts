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
  NodeState,
  OrchestratorProgress,
  PlanNodeInfo,
  Task,
  OrchestrationNodeInfo,
} from "./types.js";

export { Orchestrator };

type NodeInternalState = {
  readonly plan: PlanNodeInfo;
  readonly stage: number;
  state: NodeState;
  inputs: InputValues | null;
  outputs: OutputValues | null;
};

type OrchestratorState = Map<NodeIdentifier, NodeInternalState>;

/**
 * The Orchestrator acts as the state machine for running a graph.
 * Its primary responsibilities are:
 *
 * 1.  Lifecycle Management: Starting, resetting, and managing the overall
 * progress of a run from beginning to end.
 * 2.  Task Coordination: Determining which tasks are ready to be executed
 * based on dependencies.
 * 3.  State Persistence: Receiving results of node invocation and persisting
 * the state workflow.
 * 4.  Inspection and Debugging: Providing methods to observe the current state
 * of a run, inspect cached results, and control execution flow.
 *
 * It decouples the "what to run" (the planning) from the
 * "how to run it" (the node's execution environment)
 */
class Orchestrator {
  readonly #state: OrchestratorState = new Map();
  #currentStage: number = 0;

  constructor(public readonly plan: OrchestrationPlan) {
    this.reset();
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
            state: firstStage ? "ready" : "waiting",
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
  }

  /**
   * Provides a way to inspect the current state of nodes as they are being
   * orchestrated.
   * @returns a map representing current state of all nodes
   */
  state(): Map<NodeIdentifier, OrchestrationNodeInfo> {
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
        if (state.state === "ready") {
          tasks.push({ node: plan.node, inputs: state.inputs! });
        }
      });
      return tasks;
    } catch (e) {
      return err((e as Error).message);
    }
  }

  #propagateSkip(state: NodeInternalState): Outcome<void> {
    const targets = new Set<NodeIdentifier>();
    try {
      // First, propagate the "skipped" state downstream, collecting targets
      markDownstreamSkipped(this.#state, state, targets);
      // Now, let's propagate the "skipped" state upstream from all collected
      // targets.
      targets.forEach((id) => {
        const target = this.#state.get(id);
        if (!target) {
          throw new Error(
            "While trying to propagate skip upstream, failed to retrieve target state"
          );
        }
        markUpstreamSkipped(this.#state, target);
      });
    } catch (e) {
      return err((e as Error).message);
    }

    function markDownstreamSkipped(
      orchestratorState: OrchestratorState,
      state: NodeInternalState,
      visited: Set<NodeIdentifier>
    ) {
      const downstream = state.plan.downstream;
      downstream.forEach((dep) => {
        const id = dep.to;
        if (visited.has(id)) return;
        const target = orchestratorState.get(id);
        if (!target) {
          throw new Error(
            `While trying to propagate skip downstream, failed to retrieve target state`
          );
        }
        target.state = "skipped";
        visited.add(id);
        markDownstreamSkipped(orchestratorState, target, visited);
      });
    }

    function markUpstreamSkipped(
      orchestratorState: OrchestratorState,
      state: NodeInternalState,
      visited: Set<NodeIdentifier> = new Set()
    ) {
      const upstream = state.plan.upstream;
      upstream.forEach((dep) => {
        const id = dep.from;
        if (visited.has(id)) return;
        const source = orchestratorState.get(id);
        if (!source) {
          throw new Error(
            `While trying to propagate skip upstream, failed to retrieve source state`
          );
        }
        if (source.state === "waiting" || source.state === "ready") {
          source.state = "skipped";
        }
        visited.add(id);
        markUpstreamSkipped(orchestratorState, source, visited);
      });
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
    if (!complete) return "working";

    try {
      const nextStageIndex = this.#currentStage + 1;
      if (nextStageIndex > this.plan.stages.length - 1) return "finished";

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
          if (from.state === "waiting") {
            throw new Error(
              `While trying to advance stage, found node ${from.plan.node.id} still waiting for inputs`
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
      return "advanced";
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
