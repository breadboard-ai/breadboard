/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview
 *
 * Run dispatch helpers for run actions.
 *
 * Pure helper functions that dispatch run/stop/runFrom/runNode commands
 * to the HarnessRunner. Used by the executeNodeAction triggered action.
 */

import type { HarnessRunner, Outcome } from "@breadboard-ai/types";
import { getLogger, Formatter } from "../../../utils/logging/logger.js";

/**
 * Dispatches a stop command for a specific node.
 */
export function dispatchStop(
  nodeId: string,
  runner: HarnessRunner | null
): void {
  const stopping = runner?.stop?.(nodeId);
  if (!stopping) {
    getLogger().log(
      Formatter.warning("Runner does not support stopping"),
      "dispatchStop"
    );
    return;
  }
  stopping
    .then((outcome) => {
      if (isError(outcome)) {
        getLogger().log(
          Formatter.warning("Unable to stop", outcome.$error),
          "dispatchStop"
        );
      }
    })
    .catch((reason) => {
      getLogger().log(
        Formatter.warning("Exception thrown while stopping", reason),
        "dispatchStop"
      );
    });
}

/**
 * Dispatches a run command for a specific node.
 * If `runFromNode` is true, uses `runner.runFrom()` (run from this node
 * to the end). Otherwise uses `runner.runNode()` (run just this node).
 */
export function dispatchRun(
  runFromNode: boolean,
  nodeId: string,
  runner: HarnessRunner | null
): void {
  if (runFromNode) {
    const running = runner?.runFrom?.(nodeId);
    if (!running) {
      getLogger().log(
        Formatter.warning("Runner does not support running from a node"),
        "dispatchRun"
      );
      return;
    }
    running
      .then((outcome) => {
        if (isError(outcome)) {
          getLogger().log(
            Formatter.warning(
              `Unable to run from node "${nodeId}"`,
              outcome.$error
            ),
            "dispatchRun"
          );
        }
      })
      .catch((reason) => {
        getLogger().log(
          Formatter.warning(
            `Exception thrown while running from node "${nodeId}"`,
            reason
          ),
          "dispatchRun"
        );
      });
  } else {
    const running = runner?.runNode?.(nodeId);
    if (!running) {
      getLogger().log(
        Formatter.warning("Runner does not support running individual nodes"),
        "dispatchRun"
      );
      return;
    }
    running
      .then((outcome) => {
        if (isError(outcome)) {
          getLogger().log(
            Formatter.warning("Unable to run node", outcome.$error),
            "dispatchRun"
          );
        }
      })
      .catch((reason) => {
        getLogger().log(
          Formatter.warning("Exception thrown while running node", reason),
          "dispatchRun"
        );
      });
  }
}

/**
 * Type guard for error outcomes.
 */
function isError(outcome: Outcome<unknown>): outcome is { $error: string } {
  return typeof outcome === "object" && outcome !== null && "$error" in outcome;
}
