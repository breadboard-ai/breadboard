/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { InputValues, NodeHandlers } from "@google-labs/graph-runner";
import { makeKit } from "./kit.js";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/pinecone-kit/graphs/";

const NAMESPACE = "pinecone-api-";

const nodes = ["config", "query", "upsert", "vector"] as const;

const boards = nodes.map((node) => `${NAMESPACE}${node}`);

const boardHandlers = await Promise.all(
  boards
    .map((board) => `${KIT_URL}${board}.json`)
    .map(async (url: string) => {
      return async (inputs: InputValues) => {
        const board = await Board.load(url);
        return await board.runOnce(inputs);
      };
    })
);

const handlers: NodeHandlers = boards.reduce((acc, board, index) => {
  acc[board] = boardHandlers[index];
  return acc;
}, {} as NodeHandlers);

export const Pinecone = makeKit<(typeof nodes)[number]>(
  handlers,
  nodes,
  "npm:@google-labs/pinecone-kit",
  NAMESPACE
);
