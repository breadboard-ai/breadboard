/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createGraphStore,
  createLoader,
  type GraphDescriptor,
  type NodeDescriberResult,
} from "@google-labs/breadboard";
import { notFound } from "../errors.js";
import { getStore } from "../store.js";
import type { ApiHandler, BoardParseResult } from "../types.js";
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

const describe: ApiHandler = async (parsed, _req, res) => {
  const store = getStore();
  const { user, name } = parsed as BoardParseResult;

  const board = JSON.parse(await store.get(user!, name!)) as
    | GraphDescriptor
    | undefined;
  if (!board) {
    notFound(res, "Board not found");
    return true;
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
    const inspector = graphStore.inspectAsync(adding.result, "");
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

  return true;
};

export default describe;
