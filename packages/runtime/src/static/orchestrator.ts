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
  OrchestrationPlan,
  NodeLifecycleState,
  OrchestratorProgress,
  PlanNodeInfo,
  Task,
  OrchestrationNodeInfo,
  OrchestratorState,
  OrchestratorCallbacks,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { Signal } from "signal-polyfill";

export { Orchestrator };

type NodeInternalState = {
  readonly plan: PlanNodeInfo;
  readonly stage: number;
  state: NodeLifecycleState;
  inputs: InputValues | null;
  outputs: OutputValues | null;
};

type InternalOrchestratorState = Map<NodeIdentifier, NodeInternalState>;

const STATES_WITH_OUTPUTS: ReadonlySet<NodeLifecycleState> = new Set([
  "succeeded",
  "failed",
]);

const TERMINAL_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "succeeded",
  "failed",
  "skipped",
  "interrupted",
]);

/**
 * States where a node is currently doing something.
 */
const IN_PROGRESS_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "working",
  "waiting",
]);

const PROCESSING_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "ready",
  ...IN_PROGRESS_STATES,
]);

/**
 * States from which a node can become "working" again.
 */
const WORKABLE_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "succeeded",
  "failed",
  "interrupted",
  ...PROCESSING_STATES,
]);

/**
 * States from which a node can be restarted.
 */
const RESTARTABLE_STATES: ReadonlySet<NodeLifecycleState> = new Set([
  "ready",
  "succeeded",
  "failed",
  "interrupted",
]);

type StageAdvancementResult = "done" | "more";

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
  readonly #state: InternalOrchestratorState = new Map();
  #currentStage: number = 0;
  #progress: OrchestratorProgress = "initial";

  /**
   * A signal to manage changes to the orchestrator state, so that this
   * class can be used with signals.
   */
  readonly #changed = new Signal.State({});

  constructor(
    public readonly plan: OrchestrationPlan,
    public readonly callbacks: OrchestratorCallbacks
  ) {
    this.reset();
  }

  /**
   * Returns current progress of the orchestration.
   */
  get progress() {
    this.#changed.get();
    return this.#progress;
  }

  get working() {
    this.#changed.get();
    return Array.from(this.#state.values()).some((nodeState) => {
      return IN_PROGRESS_STATES.has(nodeState.state);
    });
  }

  get failed() {
    this.#changed.get();
    return Array.from(this.#state.values()).some((nodeState) => {
      return nodeState.state === "failed" || nodeState.state === "interrupted";
    });
  }

  /**
   * Bring the orchestrator to the initial state.
   */
  reset(): Outcome<void> {
    this.#changed.set({});
    this.#state.clear();
    this.#resetAtStage(0);
  }

  #resetAtStage(starting: number) {
    this.#changed.set({});
    const orchestratorState = this.#state;
    const stagesToReset = this.plan.stages.slice(starting);
    try {
      stagesToReset.forEach((stage, index) => {
        const firstStage = index === 0;
        stage.forEach((plan: PlanNodeInfo) => {
          const nodeState = orchestratorState.get(plan.node.id);
          const inputs = firstStage ? nodeState?.inputs || {} : null;
          const existingState = nodeState?.state || "inactive";
          let state: NodeLifecycleState;
          if (IN_PROGRESS_STATES.has(existingState)) {
            state = existingState;
          } else {
            state = firstStage ? "ready" : "inactive";
          }
          orchestratorState.set(plan.node.id, {
            stage: starting + index,
            state,
            plan,
            inputs,
            outputs: null,
          });
          this.callbacks.stateChanged?.(state, plan);
        });
      });
    } catch (e) {
      return err((e as Error).message);
    }
    this.#currentStage = starting;
    this.#progress = starting == 0 ? "initial" : "advanced";
  }

  restartAtStage(stage: number): Outcome<void> {
    if (stage < 0) {
      return this.reset();
    }
    if (stage > this.#currentStage) {
      return err(`Stage ${stage} is beyond the current stage`);
    }
    return this.#resetAtStage(stage);
  }

  restartAtNode(id: NodeIdentifier): Outcome<void> {
    this.#changed.set({});
    const state = this.#state.get(id);
    if (!state) {
      return err(`Unable to restart at node "${id}": node not found`);
    }
    if (!RESTARTABLE_STATES.has(state.state)) {
      return err(
        `Unable to restart at a node "${id}": node state is "${state.state}"`
      );
    }
    const stage = state.stage;

    // 1. Save outputs at the stage.
    const outputs: Map<NodeIdentifier, OutputValues> = new Map();
    try {
      this.plan.stages[stage].forEach((plan) => {
        const nodeId = plan.node.id;
        if (nodeId === id) {
          return;
        }
        const state = this.#state.get(nodeId);
        if (!state) {
          throw new Error(`Unable to restart at node "${id}": node not found`);
        }
        if (!state.outputs) return;
        outputs.set(nodeId, state.outputs);
      });

      const restarting = this.restartAtStage(stage);
      if (!ok(restarting)) return restarting;

      outputs.forEach((outputs, nodeId) => {
        const providing = this.provideOutputs(nodeId, outputs);
        if (!ok(providing)) {
          throw new Error(providing.$error);
        }
      });
    } catch (e) {
      return err((e as Error).message);
    }

    // Now, let's mark the node we're restarting from as "ready". This is
    // important, because providing outputs will change the node states
    // and mark our starting node as "skipped".
    const newState = this.#state.get(id);
    if (!newState) {
      return err(`Unable to restart at node "${id}": node not found`);
    }
    this.#updateNodeState(newState, "ready", false);

    // Finally, let's bring the stage back to the one where the starting node
    // is. Providing outputs will advance the stages and we may actually end up
    // in some future state. Let's roll that back and get back to ours.
    this.#currentStage = stage;
    this.#progress = stage == 0 ? "initial" : "advanced";
  }

  setWorking(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (state?.state === "working") return;

    if (!state) {
      return err(`Unable to set node "${id}" to working: node not found`);
    }
    if (!WORKABLE_STATES.has(state.state)) {
      return err(
        `Unable to set node "${id}" to working: not ready nor waiting`
      );
    }
    this.#changed.set({});
    this.#updateNodeState(state, "working", true);
  }

  setWaiting(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (state?.state === "waiting") return;

    if (!state) {
      return err(`Unable to set node "${id}" to waiting: node not found`);
    }
    if (state.state !== "working") {
      return err(`Unable to set node "${id}" to waiting: not working`);
    }
    this.#changed.set({});
    this.#updateNodeState(state, "waiting", true);
  }

  setInterrupted(id: NodeIdentifier): Outcome<void> {
    const state = this.#state.get(id);
    if (state?.state === "interrupted") return;

    if (!state) {
      return err(`Unable to set node "${id}" to interrupted: node not found`);
    }
    if (!IN_PROGRESS_STATES.has(state.state)) {
      return err(
        `Unable to set node "${id}" to interrupted: not working or waiting`
      );
    }
    this.#changed.set({});
    this.#updateNodeState(state, "interrupted", true);
    this.#propagateSkip(state);
  }

  fullState(): OrchestratorState {
    this.#changed.get();
    return new Map(
      Array.from(this.#state.entries()).map(([id, internal]) => {
        return [
          id,
          {
            node: internal.plan.node,
            state: internal.state,
            stage: internal.stage,
            inputs: internal.inputs,
            outputs: internal.outputs,
          },
        ];
      })
    );
  }

  /**
   * Provides a way to inspect the current state of nodes as they are being
   * orchestrated.
   * @returns a map representing current state of all nodes
   */
  state(): ReadonlyMap<NodeIdentifier, OrchestrationNodeInfo> {
    this.#changed.get();
    return new Map(
      Array.from(this.#state.entries()).map(([id, internal]) => {
        return [id, { node: internal.plan.node, state: internal.state }];
      })
    );
  }

  /**
   * Creates a new task to invoke a node, given a node id
   * @param id -- node id
   */
  taskFromId(id: NodeIdentifier): Outcome<Task> {
    this.#changed.get();
    const state = this.#state.get(id);
    if (!state) {
      return err(`Unknown node id "${id}"`);
    }
    if (!state.inputs) {
      return err(`Node has no inputs`);
    }
    return {
      node: state.plan.node,
      inputs: state.inputs,
    };
  }

  /**
   * Creates a list of current tasks: nodes to be invoked next, along
   * with their inputs, according to the current state of the orchestrator.
   */
  currentTasks(): Outcome<Task[]> {
    this.#changed.get();
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
    this.#changed.set({});
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
            this.#updateNodeState(target, "skipped", false);
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
          if (state.state === "working" || state.state === "waiting") return;
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
            this.#updateNodeState(state, "skipped", false);
            changed = true;
          }
        });
      }
    } catch (e) {
      return err((e as Error).message);
    }
  }

  #tryAdvancingStage(): Outcome<StageAdvancementResult> {
    this.#changed.set({});
    // Check to see if all other nodes at this stage have been invoked
    // (the state will be set to something other than "ready")
    const currentStage = this.plan.stages[this.#currentStage];
    if (!currentStage) {
      return err(
        `While trying to advance stage, failed to retrieve current stage`
      );
    }

    let hasWaiting;

    const complete = currentStage.every((plan) => {
      const state = this.#state.get(plan.node.id)?.state;
      if (!state) return false;

      if (IN_PROGRESS_STATES.has(state)) {
        hasWaiting = true;
        return false;
      }
      return state !== "ready";
    });
    // Nope, still work to do.
    if (!complete) {
      this.#progress = "working";
      return hasWaiting ? "done" : "more";
    }

    try {
      const nextStageIndex = this.#currentStage + 1;
      if (nextStageIndex > this.plan.stages.length - 1) {
        this.#progress = "finished";
        return "done";
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
          this.#updateNodeState(state, "skipped", false);
          const propagating = this.#propagateSkip(state);
          if (!ok(propagating)) return propagating;
        } else {
          this.#updateNodeState(state, "ready", false);
          state.inputs = inputs;
        }
      });
      this.#currentStage = nextStageIndex;

      // Propagate outputs from the current stage as inputs for the next stage.
      this.#progress = "advanced";
      return "more";
    } catch (e) {
      return err((e as Error).message);
    }
  }

  #updateNodeState(
    node: NodeInternalState,
    state: NodeLifecycleState,
    changedByConsumer: boolean
  ) {
    node.state = state;
    this.callbacks.stateChanged?.(state, node.plan);
    if (!changedByConsumer) {
      const id = node.plan.node.id;
      this.callbacks.stateChangedbyOrchestrator?.(
        id,
        state,
        node.outputs?.["$error"]
      );
    }
  }

  update(old: Orchestrator) {
    const oldEntries = [...(old.#state.entries() || [])];
    if (oldEntries.length === 0) {
      return;
    }
    let index = 0;
    for (const [id, newNodeState] of this.#state) {
      const [oldId, oldNodeState] = oldEntries[index] || [];
      if (id === oldId) {
        if (
          oldNodeState.outputs &&
          STATES_WITH_OUTPUTS.has(oldNodeState.state)
        ) {
          this.provideOutputs(id, oldNodeState.outputs);
        } else {
          newNodeState.state = oldNodeState.state;
        }
      } else {
        if (index === 0) {
          // Account for the situation when the topology changes so that
          // there are no similarities in plan. In this case, we make the
          // first node as "interrupted", so that it doesn't trigger
          // continuation of a run if we're in the middle of one.
          newNodeState.state = "interrupted";
        }
        break;
      }
      index++;
    }
  }

  /**
   * Submit results of a node invocation. Also updates the current state.
   */
  provideOutputs(
    id: NodeIdentifier,
    outputs: OutputValues
  ): Outcome<OrchestratorProgress> {
    this.#changed.set({});
    const state = this.#state.get(id);
    if (!state) {
      return err(
        `While providing outputs, couldn't get state for node "${id}"`
      );
    }
    let earlierStage = false;
    if (state.stage < this.#currentStage) {
      earlierStage = true;
    } else if (state.stage > this.#currentStage) {
      return err(`Can't provide outputs to later stages`);
    }
    if (state.state === "waiting") {
      return err(`Can't provide outputs while the node is waiting for input`);
    }
    // Update state of the node.
    state.outputs = outputs;
    if ("$error" in outputs) {
      this.#updateNodeState(state, "failed", false);
      if (earlierStage) return this.#progress;

      const propagating = this.#propagateSkip(state);
      if (!ok(propagating)) return propagating;
    } else {
      this.#updateNodeState(state, "succeeded", false);
      if (earlierStage) {
        // Jump back to the node's stage, so that we propagate
        // from it.
        this.#currentStage = state.stage;
      }
    }

    let progress;
    for (;;) {
      progress = this.#tryAdvancingStage();
      if (!ok(progress)) return progress;
      if (progress === "done") break;

      const hasWork = this.currentTasks();
      if (!ok(hasWork)) return hasWork;

      if (hasWork.length > 0) break;
    }
    return this.#progress;
  }
}
