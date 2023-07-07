/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A simple graph test harness
 */

import test, { ExecutionContext } from "ava";

import { readFile, readdir } from "fs/promises";

import { traverseGraph } from "../src/traversal.js";
import {
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  LogData,
  NodeHandlers,
  OutputValues,
} from "../src/types.js";

const IN_DIR = "./tests/data/";

interface TestGraphDescriptor extends GraphDescriptor {
  sequence: string[];
  outputs: string[];
}

class MockContext implements GraphTraversalContext {
  handlers: NodeHandlers;
  outputs: string[] = [];
  currentGraph: GraphDescriptor | null = null;
  sequence: string[] = [];

  constructor() {
    this.handlers = {
      input: async (_cx, inputs) => {
        return this.requestExternalInput(inputs);
      },
      output: async (_cx, inputs) => {
        return this.provideExternalOutput(inputs);
      },
    };
    this.log = this.log.bind(this);
  }

  async requestExternalInput(_inputs: InputValues): Promise<OutputValues> {
    return { text: "foo" };
  }

  async provideExternalOutput(inputs: InputValues): Promise<void> {
    this.outputs.push(inputs.text as string);
  }

  async requestSlotOutput(
    slot: string,
    inputs: InputValues
  ): Promise<OutputValues> {
    throw new Error("Method not implemented.");
  }

  async setCurrentGraph(graph: GraphDescriptor): Promise<void> {
    this.currentGraph = graph;
  }

  async getCurrentGraph(): Promise<GraphDescriptor> {
    return this.currentGraph as GraphDescriptor;
  }

  async log(data: LogData): Promise<void> {
    if (data.type === "node") this.sequence.push(data.value as string);
  }
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;
      const context = new MockContext();
      await traverseGraph(context, graph);
      t.deepEqual(context.outputs, graph.outputs);
      t.deepEqual(context.sequence, graph.sequence);
    });
  })
);
