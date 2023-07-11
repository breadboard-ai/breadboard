/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { TraversalMachine } from "../src/index.js";

import { GraphDescriptor, InputValues, OutputValues } from "../src/types.js";

const IN_DIR = "./tests/data/";

interface TestGraphDescriptor extends GraphDescriptor {
  sequence: string[];
  inputs: InputValues;
  outputs: OutputValues;
  throws: boolean;
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;
      const machine = new TraversalMachine(graph);
      const outputs = {};
      const sequence: string[] = [];
      const run = async () => {
        for await (const result of machine) {
          if (result.skip) continue;
          const { inputs, descriptor } = result;
          sequence.push(descriptor.id);
          switch (descriptor.type) {
            case "input":
              result.outputs = graph.inputs;
              break;
            case "output":
              Object.assign(outputs, inputs);
              break;
            case "noop":
              result.outputs = inputs;
              break;
            default:
              throw new Error(`Unknown node: ${descriptor.id}`);
          }
        }
      };
      if (graph.throws) await t.throwsAsync(run);
      else await run();
      t.deepEqual(outputs, graph.outputs);
      t.deepEqual(sequence, graph.sequence);
    });
  })
);
