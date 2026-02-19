/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Trigger definitions for Run actions.
 *
 * Signal triggers watch controller state (topology version, action requests).
 * Event triggers listen on the stable `runnerEventBus` proxy, bridging
 * ephemeral HarnessRunner events into the SCA coordination system.
 */

import {
  signalTrigger,
  eventTrigger,
  type SignalTrigger,
  type EventTrigger,
} from "../../coordination.js";
import { type ActionBind } from "../binder.js";

// =============================================================================
// Signal Triggers
// =============================================================================

/**
 * Creates a trigger that fires when graph version changes.
 * Used to sync run console state when graph topology changes during a run.
 */
export function onGraphVersionForSync(bind: ActionBind): SignalTrigger {
  return signalTrigger("Graph Version (Sync)", () => {
    const { controller } = bind;
    // Return a new value on every version bump so the signal system
    // detects a change. A boolean (>= 0) would be "sticky" — once true,
    // subsequent bumps produce the same value and the trigger never re-fires.
    const version = controller.editor.graph.version;
    return version >= 0 ? version + 1 : false;
  });
}

/**
 * Creates a trigger that fires when a node action request is set.
 *
 * Watches RunController.nodeActionRequest and fires when it changes
 * to a non-null value. Used by executeNodeAction to dispatch the
 * run/stop/runFrom/runNode command.
 */
export function onNodeActionRequested(bind: ActionBind): SignalTrigger {
  return signalTrigger("Node Action Requested (Run)", () => {
    const { controller } = bind;
    return controller.run.main.nodeActionRequest !== null;
  });
}

/**
 * Creates a trigger that fires when graph topology changes.
 * Used to re-prepare the runner so the console reflects the current graph.
 */
export function onTopologyChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Topology Change (Re-prepare)", () => {
    const { controller } = bind;
    // +1 so version 0 isn't falsy; each increment produces a unique value.
    return controller.editor.graph.topologyVersion + 1;
  });
}

/**
 * Creates a trigger that fires when a run is stopped.
 * Used to re-prepare the runner so the console is repopulated with "inactive"
 * entries and the Start button stays active after stop.
 */
export function onRunStopped(bind: ActionBind): SignalTrigger {
  return signalTrigger("Run Stopped (Re-prepare)", () => {
    const { controller } = bind;
    const v = controller.run.main.stopVersion;
    // +1 so version 0 isn't falsy (same pattern as other version triggers).
    return v > 0 ? v + 1 : false;
  });
}

// =============================================================================
// Runner Event Triggers
// =============================================================================

/**
 * All runner event triggers listen on the stable `runnerEventBus` owned by
 * `RunService`. Events are forwarded from the ephemeral HarnessRunner as
 * `CustomEvent` instances, with the original event `data` in `event.detail`.
 */

/** Fires when the runner starts. */
export function onRunnerStart(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Start",
    services.runService.runnerEventBus,
    "start"
  );
}

/** Fires when the runner resumes from a pause. */
export function onRunnerResume(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Resume",
    services.runService.runnerEventBus,
    "resume"
  );
}

/** Fires when the runner pauses. */
export function onRunnerPause(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Pause",
    services.runService.runnerEventBus,
    "pause"
  );
}

/** Fires when the runner ends. */
export function onRunnerEnd(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger("Runner End", services.runService.runnerEventBus, "end");
}

/** Fires when the runner reports an error. */
export function onRunnerError(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Error",
    services.runService.runnerEventBus,
    "error"
  );
}

/** Fires when a graph starts execution. */
export function onRunnerGraphStart(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Graph Start",
    services.runService.runnerEventBus,
    "graphstart"
  );
}

/** Fires when a node starts execution. */
export function onRunnerNodeStart(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Node Start",
    services.runService.runnerEventBus,
    "nodestart"
  );
}

/** Fires when a node finishes execution. */
export function onRunnerNodeEnd(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Node End",
    services.runService.runnerEventBus,
    "nodeend"
  );
}

/** Fires when a node's lifecycle state changes. */
export function onRunnerNodeStateChange(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Node State Change",
    services.runService.runnerEventBus,
    "nodestatechange"
  );
}

/** Fires when edge states change. */
export function onRunnerEdgeStateChange(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Edge State Change",
    services.runService.runnerEventBus,
    "edgestatechange"
  );
}

/** Fires when the runner produces output. */
export function onRunnerOutput(bind: ActionBind): EventTrigger {
  const { services } = bind;
  return eventTrigger(
    "Runner Output",
    services.runService.runnerEventBus,
    "output"
  );
}
