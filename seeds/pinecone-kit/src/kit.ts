/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { InputValues, NodeHandlers } from "@google-labs/graph-runner";

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
