/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier, Outcome } from "@breadboard-ai/types";

/**
 * Very WIP, sketching out reactive Model + Controller
 * that replaces the current HarnessRunner
 */
export type OrchestrationController = {
  /**
   * Run the graph from start to finish or the next breakpoint.
   * Always restarts, resetting current state.
   * Promise resolves when the run completes.
   */
  run(): Promise<Outcome<void>>;
  /**
   * Run all incomplete stages to finish or the next breakpoint.
   * Promise resolves when the run completes.
   */
  continue(): Promise<Outcome<void>>;
  /**
   * Invoke the next "ready" node in the orchestration.
   * Promise resolves when the node invocation completes.
   * If the node reports failure, this is not an error that affects outcome.
   */
  stepThroughNode(): Promise<Outcome<void>>;
  /**
   * Step through the next incomplete stage in the orchestration.
   * Promise resolves when the stage completes.
   */
  stepThroughStage(): Promise<Outcome<void>>;
  /**
   * Provides a way to manage breakpoints.
   */
  breakpoints: BreakpointsController;
};

export type BreakpointsController = {
  /**
   * All current breakpoints.
   */
  readonly breakpoints: ReadonlyMap<NodeIdentifier, Breakpoint>;
  /**
   * Creates a breakpoint. Can be called multiple times on the same node.
   * @param node - the node at which to set the breakpoint
   */
  create(node: NodeIdentifier): void;
  /**
   * Removes a breakpoint. Can be called multiple times on the same node.
   * @param node - the node at which to remove the breakpoint
   */
  delete(node: NodeIdentifier): void;
  /**
   * Clears all breakpoints.
   */
  clear(): void;
};

export type Breakpoint = {
  /**
   * The node at which the breakpoint is set.
   */
  readonly id: NodeIdentifier;
  /**
   * Disables the breakpoint.
   */
  disable(): void;
  /**
   * Enables the breakpoint.
   */
  enable(): void;
};
