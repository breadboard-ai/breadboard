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
  LogData,
  NodeHandlers,
  OutputValues,
} from "../types.js";
import { traverseGraph } from "../traversal.js";

type SlottedGraphs = Record<string, GraphDescriptor>;

type IncludeInput = {
  path?: string;
  $ref?: string;
  slotted?: SlottedGraphs;
  args: InputValues;
};

class IncludeContext implements GraphTraversalContext {
  log: (data: LogData) => Promise<void>;
  values: OutputValues = {};
  handlers: NodeHandlers;
  slotted: SlottedGraphs;
  #graph?: GraphDescriptor;

  constructor(
    private inputs: InputValues,
    context: GraphTraversalContext,
    slotted?: SlottedGraphs
  ) {
    this.handlers = context.handlers;
    this.log = async (data: LogData) => {
      const nest = ((data.nest as number) || 0) + 1;
      context.log({
        ...data,
        nest,
      });
    };
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
    this.log({
      source: "include",
      text: `Traversing slotted graph for slot "${slot}"`,
    });
    await traverseGraph(includeContext, graph);
    return includeContext.values;
  }

  async setCurrentGraph(graph: GraphDescriptor): Promise<void> {
    this.#graph = graph;
  }

  async getCurrentGraph(): Promise<GraphDescriptor> {
    return this.#graph as GraphDescriptor;
  }
}

/**
 * @todo Make this just take a $ref and figure out when it's a path or a URL.
 * @param path
 * @param ref
 * @returns
 */
export const loadGraph = async (path?: string, ref?: string) => {
  if (path) return JSON.parse(await readFile(path, "utf-8"));
  if (!ref) throw new Error("To include, we need a path or a $ref");
  const response = await fetch(ref);
  return await response.json();
};

export default async (context: GraphTraversalContext, inputs: InputValues) => {
  const { path, $ref, slotted, ...args } = inputs as IncludeInput;
  const graph = await loadGraph(path, $ref);
  const includeContext = new IncludeContext(args, context, slotted);
  context.log({
    source: "include",
    text: `Including graph at "${path}"`,
  });
  await traverseGraph(includeContext, graph);
  return includeContext.values;
};
