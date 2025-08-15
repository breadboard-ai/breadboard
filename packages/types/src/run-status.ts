/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * pending:   This node has no known running state; usually this means that no
 *            controls will be shown.
 * available: This node can be run. The controls show a play button.
 * paused:    This node can be resumed. The controls show a play button.
 * running:   This node can be paused. The controls show a pause button.
 * active:    This node is running and can not be paused. The controls show a
 *            spinner.
 */
export type NodeRunStatus =
  | "pending"
  | "available"
  | "paused"
  | "running"
  | "active";

export type NodeRunState =
  | {
      status: NodeRunStatus;
    }
  | {
      status: "error";
      errorMessage: string;
    };
