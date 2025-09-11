/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeLifecycleState } from "./orchestration.js";

/**
 * inactive:  This node is not ready to run, but a breakpoint can be set on it
 * ready:     This node is ready to run
 * working:   The node is doing work
 * waiting:   The node is doing work
 * succeeded: The node succeeded running
 * failed:    The node failed
 * skipped:   The node was skipped, because previous nodes failed or were
 *            interrupted
 * interrupted: The node was interrupted
 * breakpoint: The node has a set breakpoint associated with it
 */
export type NodeRunStatus =
  | Exclude<NodeLifecycleState, "failed">
  | "breakpoint";

export type NodeRunState =
  | {
      status: NodeRunStatus;
    }
  | {
      status: "failed";
      errorMessage: string;
    };
