/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import {
  GraphDescriptor,
  InputValues,
  NodeHandlers,
} from "@google-labs/graph-runner";

export const makeHandlersFromUrls = async (
  nodes: readonly string[],
  baseUrl: string,
  nodePrefix: string
) => {
  const boards = nodes.map((node) => `${nodePrefix}${node}`);

  const boardHandlers = await Promise.all(
    boards
      .map((board) => `${baseUrl}${board}.json`)
      .map(async (url: string) => {
        return async (inputs: InputValues) => {
          const board = await Board.load(url);
          return await board.runOnce(inputs);
        };
      })
  );

  return boards.reduce((acc, board, index) => {
    acc[board] = boardHandlers[index];
    return acc;
  }, {} as NodeHandlers);
};

/**
 * Creates a NodeHandlers object from a `GraphDescriptor`.
 * Each node in `nodes` array of the `GraphDescriptor` is converted
 * to a handler function that runs the node, with all the configuration
 * preserved as part of the handler function.
 * @param graph
 */
export const makeHandlersFromGraphDescriptor = async (
  graph: GraphDescriptor,
  baseUrl: string,
  prefix = ""
) => {
  const board = await Board.fromGraphDescriptor(graph);
  board.url = baseUrl;
  const handlers = await Board.handlersFromBoard(board);
  // Add prefixes to the handlers and close over configuration.
  return graph.nodes.reduce((acc, node) => {
    acc[`${prefix}${node.id}`] = async (inputs: InputValues) => {
      const configuration = node.configuration;
      if (configuration) {
        inputs = { ...configuration, ...inputs };
      }
      return handlers[node.type](inputs);
    };
    return acc;
  }, {} as NodeHandlers);
};
