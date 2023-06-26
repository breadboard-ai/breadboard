/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import type {
  GraphTraversalContext,
  InputValues,
  OutputValues,
} from "../types.js";
import { BaseTraversalContext, traverseGraph } from "../traversal.js";

class IncludeContext extends BaseTraversalContext {
  log: (s: string) => void;
  values: OutputValues = {};

  constructor(private inputs: InputValues, context: GraphTraversalContext) {
    super(context.handlers);
    this.log = context.log;
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    return this.inputs;
  }

  async provideExternalOutput(outputs: OutputValues): Promise<void> {
    this.values = outputs;
  }
}

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  const { path, ...args } = inputs;
  if (!path) throw new Error("To include, we need a path");
  const graph = JSON.parse(await readFile(path as string, "utf-8"));
  const includeContext = new IncludeContext(args, context);
  await traverseGraph(includeContext, graph);
  return includeContext.values;
};
