/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardCapability,
  GraphDescriptor,
  NodeHandlerContext,
} from "./types.js";

import {
  isBreadboardCapability,
  isGraphDescriptorCapability,
  isResolvedURLBoardCapability,
  isUnresolvedPathBoardCapability,
} from "./capability.js";
import { GraphLoader } from "./loader/types.js";

/**
 * This class is the main entry point for running a board.
 *
 * It contains everything that is needed to run a board, either loaded from a
 * serialized board or created via the {Board} class.
 *
 * See the {Board} class for a way to build a board that can also be serialized.
 */
export class BoardRunner {
  /**
   * Creates a runnable board from a BreadboardCapability,
   * @param board {BreadboardCapability} A BreadboardCapability including a board
   * @returns {Board} A runnable board.
   */
  static async fromBreadboardCapability(
    capability: BreadboardCapability,
    loader?: GraphLoader,
    context?: NodeHandlerContext
  ): Promise<GraphDescriptor> {
    if (!isBreadboardCapability(capability)) {
      throw new Error(
        `Expected a "board" Capability, but got "${JSON.stringify(capability)}`
      );
    }

    // TODO: Deduplicate, replace with `getGraphDescriptor`.
    if (isGraphDescriptorCapability(capability)) {
      // If all we got is a GraphDescriptor, build a runnable board from it.
      // TODO: Use JSON schema to validate rather than this hack.
      const board = capability.board;
      const runnableBoard = board as GraphDescriptor;
      return runnableBoard;
    } else if (isResolvedURLBoardCapability(capability)) {
      if (!loader || !context) {
        throw new Error(
          `The "board" Capability is a URL, but no loader and/or context was supplied.`
        );
      }
      const graph = await loader.load(capability.url, context);
      if (!graph) {
        throw new Error(
          `Unable to load "board" Capability with the URL of ${capability.url}.`
        );
      }
      return graph;
    } else if (isUnresolvedPathBoardCapability(capability)) {
      throw new Error(
        `Integrity error: somehow, the unresolved path "board" Capability snuck through the processing of inputs`
      );
    }
    throw new Error(
      `Unsupported type of "board" Capability. Perhaps the supplied board isn't actually a GraphDescriptor?`
    );
  }
}
