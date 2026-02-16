/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Input queue helpers for run actions.
 *
 * These are pure helper functions that take explicit controller dependencies
 * rather than closing over `bind`. They manage the lifecycle of input
 * requests: queueing, activation, resolution, and cleanup.
 */

import type { Schema, OutputValues } from "@breadboard-ai/types";
import type { AppController } from "../../../controller/controller.js";
import { getLogger, Formatter } from "../../../utils/logging/logger.js";

/**
 * Handles a new input request from a node.
 *
 * Adds the node to the pending queue. If no input is currently active,
 * activates this one immediately (bumps its screen, marks as input,
 * sets the reactive input signal). Otherwise queues silently.
 */
export function handleInputRequested(
  id: string,
  schema: Schema,
  run: AppController["run"]
): void {
  // Add to the pending queue.
  run.main.addPendingInput(id, schema);

  // Only activate if no input is currently active.
  if (!run.main.input) {
    activateInputEntry(id, schema, run);
  }
}

/**
 * Activates a pending input entry: bumps its screen to the end of the list,
 * marks it as input, updates the renderer, and sets the reactive input signal.
 */
function activateInputEntry(
  id: string,
  schema: Schema,
  run: AppController["run"]
): void {
  // Bump the screen to the bottom of the list (last = current).
  run.screen.bumpScreen(id);
  const screen = run.screen.screens.get(id);
  if (screen) {
    screen.markAsInput();
  }

  // Tell the console entry to create its WorkItem.
  run.main.console.get(id)?.activateInput();

  // Mark the node as waiting for input in the renderer.
  run.renderer.setNodeState(id, { status: "waiting" });

  // Set the reactive input signal so the UI shows the input form.
  run.main.setInput({ id, schema });
}

/**
 * Resolves a pending input request with user-provided values.
 *
 * After resolving, advances to the next queued input (if any).
 */
export function provideInput(
  values: OutputValues,
  run: AppController["run"]
): void {
  if (!run.main.input) {
    getLogger().log(
      Formatter.warning("provideInput called but no pending input request"),
      "provideInput"
    );
    return;
  }
  const { id } = run.main.input;
  const entry = run.main.console.get(id);
  if (!entry) {
    getLogger().log(
      Formatter.warning(
        `provideInput: no console entry found for node "${id}"`
      ),
      "provideInput"
    );
    return;
  }

  // Remove from pending queue.
  run.main.removePendingInput(id);

  // Reset the screen type back to "progress" now that input is collected.
  const screen = run.screen.screens.get(id);
  if (screen) {
    screen.type = "progress";
  }

  // Mark the node as working again.
  run.renderer.setNodeState(id, { status: "working" });

  // Resolve the pending Promise in the console entry.
  entry.resolveInput(values);

  // Advance to the next pending input (if any), or clear.
  advanceInputQueue(run);
}

/**
 * Cleans up all input-related state when a node is stopped.
 * Aborts the pending input promise, removes from queue,
 * and advances to the next queued input if this was the active one.
 */
export function cleanupStoppedInput(
  id: string,
  run: AppController["run"]
): void {
  const entry = run.main.console.get(id);
  if (entry && "abortInput" in entry) {
    (entry as { abortInput(): void }).abortInput();
  }

  run.main.removePendingInput(id);
  run.screen.deleteScreen(id);

  if (run.main.input?.id === id) {
    advanceInputQueue(run);
  }
}

/**
 * Advances the input queue to the next pending input, or clears
 * the active input if the queue is empty.
 */
function advanceInputQueue(run: AppController["run"]): void {
  const nextId = run.main.nextPendingInputId;

  if (nextId) {
    const nextSchema = run.main.inputSchemas.get(nextId);
    if (nextSchema) {
      activateInputEntry(nextId, nextSchema, run);
    } else {
      run.main.clearInput();
    }
  } else {
    run.main.clearInput();
  }
}
