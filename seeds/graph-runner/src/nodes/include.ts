/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import type {
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  NodeHandlers,
  OutputValues,
} from "../types.js";
import { traverseGraph } from "../traversal.js";

type SlottedGraphs = Record<string, GraphDescriptor>;

type IncludeInput = {
  path: string;
  slotted?: SlottedGraphs;
  args: InputValues;
};

class IncludeContext implements GraphTraversalContext {
  log: (s: string) => void;
  values: OutputValues = {};
  handlers: NodeHandlers;
  slotted: SlottedGraphs;

  constructor(
    private inputs: InputValues,
    context: GraphTraversalContext,
    slotted?: SlottedGraphs
  ) {
    this.handlers = context.handlers;
    this.log = context.log;
    this.slotted = slotted || {};
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    return this.inputs;
  }

  async provideExternalOutput(outputs: OutputValues): Promise<void> {
    this.values = outputs;
  }

  async requestSlotOutput(
    slot: string,
    args: InputValues
  ): Promise<OutputValues> {
    if (!this.slotted) throw new Error("No slotted sub-graphs were provided");
    const graph = this.slotted[slot];
    if (!graph) throw new Error(`No graph found for slot "${slot}"`);
    const includeContext = new IncludeContext(args, this, {});
    await traverseGraph(includeContext, graph);
    return includeContext.values;
  }
}

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  const { path, slotted, ...args } = inputs as IncludeInput;
  if (!path) throw new Error("To include, we need a path");
  const graph = JSON.parse(await readFile(path, "utf-8"));
  const includeContext = new IncludeContext(args, context, slotted);
  await traverseGraph(includeContext, graph);
  return includeContext.values;
};
