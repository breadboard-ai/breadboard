/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from "express";

import {
  createGraphStore,
  createLoader,
  StubFileSystem,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";
import type { StorageBoard } from "../store.js";

export const addKeyInput = (describeResult: NodeDescriberResult) => {
  const inputSchema = describeResult.inputSchema;
  const properties = inputSchema.properties;
  if (properties) {
    properties.$key = {
      type: "string",
      title: "Service Key",
      description: "The key to access the service",
    };
  }
  inputSchema.required ??= [];
  inputSchema.required.push("$key");
};

function emptyDescriberResult(): NodeDescriberResult {
  return {
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
  };
}

async function describe(_req: Request, res: Response): Promise<void> {
  const board: StorageBoard | undefined = res.locals.loadedBoard;
  const graph = board?.graph;
  if (!graph) {
    res.sendStatus(404);
    return;
  }

  const loader = createLoader();
  const graphStore = createGraphStore({
    kits: [],
    loader,
    sandbox: {
      async createRunnableModule() {
        throw new Error("Not implemented");
      },
    },
    fileSystem: new StubFileSystem(),
  });

  const adding = graphStore.addByDescriptor(graph);
  let describeResult: NodeDescriberResult;
  if (!adding.success) {
    describeResult = emptyDescriberResult();
  } else {
    const inspector = graphStore.inspect(adding.result, "");
    if (!inspector) {
      describeResult = emptyDescriberResult();
    } else {
      describeResult = await inspector.describe();
    }
  }
  const { title, description, metadata } = graph;
  addKeyInput(describeResult);
  const result = {
    ...describeResult,
    title,
    description,
    metadata,
  } as NodeDescriberResult;

  res.json(result);
}

export default describe;
