/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  Kit,
  NodeFactory,
  OptionalIdConfiguration,
} from "@google-labs/breadboard";
import { InputValues, NodeHandlers } from "@google-labs/graph-runner";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/pinecone-kit/graphs/";

const boards = [
  "pinecone-api-config",
  "pinecone-api-query",
  "pinecone-api-upsert",
  "pinecone-api-vector",
];

const BOARD_URLS = boards.map((board) => `${KIT_URL}${board}.json`);

const boardHandlers = await Promise.all(
  BOARD_URLS.map(async (url: string) => {
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

export class Pinecone implements Kit {
  url = "npm:@google-labs/pinecone-kit";

  #nodeFactory: NodeFactory;
  #handlers: NodeHandlers;

  get handlers() {
    return this.#handlers;
  }

  constructor(nodeFactory: NodeFactory) {
    this.#nodeFactory = nodeFactory;
    this.#handlers = handlers;
  }

  config(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-api-config", { ...rest }, $id);
  }

  query(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-api-query", { ...rest }, $id);
  }

  upsert(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-api-upsert", { ...rest }, $id);
  }

  vector(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-api-vector", { ...rest }, $id);
  }
}
