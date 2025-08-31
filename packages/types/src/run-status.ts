/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeLifecycleState } from "./orchestration.js";

/**
 * inactive:  This node is not ready to run, but a breakpoint can be set on it
 *            - icon: [none]
 *            - hover: pause
 * ready:     This node is ready to run
 *            - icon: play_arrow
 *            - hover: play_arrow
 * working:   The node is doing work
 *            - icon: spinner
 *            - hover: stop
 * waiting:   The node is doing work
 *            - icon: spinner
 *            - hover: stop
 * succeeded: The node succeeded running
 *            - icon: autorenew
 *            - hover: pause
 * failed:    The node failed
 *            - icon: autorenew
 *            - hover: autorenew
 * skipped:   The node was skipped, because previous nodes failed or were
 *            interrupted
 *            - icon: [none]
 *            - hover: pause
 * interrupted: The node was interrupted
 *            - icon: autorenew
 *            - hover: autorenew
 * breakpoint: The node has a set breakpoint associated with it
 *            - icon: pause
 *            - hover: close
 */
export type NodeRunStatus =
  | Exclude<NodeLifecycleState, "failed" | "interrupted">
  | "breakpoint";

export type NodeRunState =
  | {
      status: NodeRunStatus;
    }
  | {
      status: "failed" | "interrupted";
      errorMessage: string;
    };
