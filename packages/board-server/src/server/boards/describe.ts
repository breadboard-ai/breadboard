/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Response } from "express";

import {
  createGraphStore,
  createLoader,
  type GraphDescriptor,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import { notFound } from "../errors.js";
import { getStore } from "../store.js";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";

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

async function describe(
  user: string,
  name: string,
  res: Response
): Promise<void> {
  const store = getStore();
  const board = JSON.parse(await store.get(user!, name!)) as
    | GraphDescriptor
    | undefined;
  if (!board) {
    notFound(res, "Board not found");
    return;
  }

  const loader = createLoader();
  const graphStore = createGraphStore({
    kits: [],
    loader,
    sandbox: new NodeSandbox(),
  });

  const adding = graphStore.addByDescriptor(board);
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
  const { title, description, metadata } = board;
  addKeyInput(describeResult);
  const result = {
    ...describeResult,
    title,
    description,
    metadata,
  } as NodeDescriberResult;

  res.writeHead(200, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(result));
}

export default describe;
