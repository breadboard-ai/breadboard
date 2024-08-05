/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BreadboardCapability,
  BreadboardRunner,
  Edge,
  GraphDescriptor,
  GraphInlineMetadata,
  InputValues,
  Kit,
  NodeDescriptor,
  NodeHandlerContext,
  SubGraphs,
} from "./types.js";

import breadboardSchema from "@google-labs/breadboard-schema/breadboard.schema.json" with { type: "json" };
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
export class BoardRunner implements BreadboardRunner {
  // GraphDescriptor implementation.
  url?: string;
  title?: string;
  description?: string;
  $schema?: string;
  version?: string;
  edges: Edge[] = [];
  nodes: NodeDescriptor[] = [];
  kits: Kit[] = [];
  graphs?: SubGraphs;
  args?: InputValues;

  /**
   *
   * @param metadata - optional metadata for the board. Use this parameter
   * to provide title, description, version, and URL for the board.
   */
  constructor(
    { url, title, description, version, $schema }: GraphInlineMetadata = {
      $schema: breadboardSchema.$id,
    }
  ) {
    Object.assign(this, {
      $schema: $schema ?? breadboardSchema.$id,
      url,
      title,
      description,
      version,
    });
  }

  /**
   * Creates a new board from JSON. If you have a serialized board, you can
   * use this method to turn it into into a new Board instance.
   *
   * @param graph - the JSON representation of the board.
   * @returns - a new `Board` instance.
   */
  static async fromGraphDescriptor(
    graph: GraphDescriptor
  ): Promise<BoardRunner> {
    const breadboard = new BoardRunner(graph);
    breadboard.edges = graph.edges;
    breadboard.nodes = graph.nodes;
    breadboard.graphs = graph.graphs;
    breadboard.args = graph.args;
    return breadboard;
  }

  /**
   * Creates a runnable board from a BreadboardCapability,
   * @param board {BreadboardCapability} A BreadboardCapability including a board
   * @returns {Board} A runnable board.
   */
  static async fromBreadboardCapability(
    capability: BreadboardCapability,
    loader?: GraphLoader,
    context?: NodeHandlerContext
  ): Promise<BoardRunner> {
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
      const runnableBoard = board as BoardRunner;
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
      return BoardRunner.fromGraphDescriptor(graph);
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
