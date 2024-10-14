/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, NodeIdentifier } from "@breadboard-ai/types";
import {
  createRunStateManager,
  ReanimationState,
  type InspectableRun,
} from "@google-labs/breadboard";
import { RunConfig } from "@google-labs/breadboard/harness";
import { Result, RunNodeConfig } from "./types";

export { getRunNodeConfig };

function error<T>(message: string): Result<T> {
  console.warn(message);
  return {
    success: false,
    error: message,
  };
}

async function getRunNodeConfig(
  nodeId: NodeIdentifier,
  inputs: InputValues | undefined,
  run: InspectableRun
): Promise<Result<Partial<RunNodeConfig>>> {
  // Might have multiple of those.
  const targets = run.events.filter(
    (event) => event.type === "node" && event.node.descriptor.id === nodeId
  );
  // For now, take the last one. Eventually, let the user pick.
  const target = targets.at(-1);
  if (!target) {
    return error("Unable to find the node in the run. Likely a bug somewhere.");
  }
  const reanimationState: ReanimationState | undefined =
    await run.reanimationStateAt?.(target.id);
  if (!reanimationState) {
    return error(`Unable to create resume point for target "${target.id}"`);
  }
  const history = reanimationState.history;
  const config: Partial<RunConfig> = {
    state: createRunStateManager(reanimationState, inputs),
    // stopAfter: nodeId,
  };
  return { success: true, result: { config, history } };

  // Stop at target
  // Run node and stop
}
