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

import pineconeAPIConfig from "./boards/pinecone-api-config.js";
import pineconeQuery from "./boards/pinecone-api-query.js";
import pineconeUpsert from "./boards/pinecone-api-upsert.js";
import pineconeVector from "./boards/pinecone-api-vector.js";

const wrapBoard = (board: Board) => {
  return async (inputs: InputValues) => {
    board.url = inputs["$boardUrl"] as string;
    return await board.runOnce(inputs);
  };
};

const handlers: NodeHandlers = {
  "pinecone-config": wrapBoard(pineconeAPIConfig),
  "pinecone-query": wrapBoard(pineconeQuery),
  "pinecone-upsert": wrapBoard(pineconeUpsert),
  "pinecone-vector": wrapBoard(pineconeVector),
};

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
    return this.#nodeFactory.create("pinecone-config", { ...rest }, $id);
  }

  query(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-query", { ...rest }, $id);
  }

  upsert(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-upsert", { ...rest }, $id);
  }

  vector(config: OptionalIdConfiguration = {}) {
    const { $id, ...rest } = config;
    return this.#nodeFactory.create("pinecone-vector", { ...rest }, $id);
  }
}
