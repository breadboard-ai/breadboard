/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeConfiguration,
  NodeIdentifier,
} from "@breadboard-ai/types";
import {
  createRunStateManager,
  ReanimationState,
  type InspectableRun,
} from "@google-labs/breadboard";
import { RunConfig } from "@breadboard-ai/types";
import { Result, RunNodeConfig } from "./types";

export { getRunNodeConfig };

function error<T>(message: string): Result<T> {
  console.warn(message);
  return {
    success: false,
    error: message,
  };
}

function success<T>(result: T): Result<T> {
  return { success: true, result };
}

async function reanimationStateFromRun(
  nodeId: NodeIdentifier,
  run: InspectableRun,
  nodeConfig: NodeConfiguration | undefined
): Promise<Result<ReanimationState>> {
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
    await run.reanimationStateAt?.(target.id, nodeConfig);
  if (!reanimationState) {
    return error(`Unable to create resume point for target "${target.id}"`);
  }
  return success(reanimationState);
}

async function getRunNodeConfig(
  nodeId: NodeIdentifier,
  nodeConfig: InputValues | undefined,
  run: InspectableRun | undefined
): Promise<Result<Partial<RunNodeConfig>>> {
  if (!run) {
    return success<Partial<RunNodeConfig>>({ config: { stopAfter: nodeId } });
  }
  const reanimationStateResult = await reanimationStateFromRun(
    nodeId,
    run,
    nodeConfig
  );
  if (!reanimationStateResult.success) {
    return error(reanimationStateResult.error);
  }
  const reanimationState = reanimationStateResult.result;
  const history = reanimationState.history;
  const config: Partial<RunConfig> = {
    state: createRunStateManager(reanimationState),
    stopAfter: nodeId,
  };
  return { success: true, result: { config, history } };

  // Stop at target
  // Run node and stop
}
